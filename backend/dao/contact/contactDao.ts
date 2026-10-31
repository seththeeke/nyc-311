import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { Dao } from "../dao";
import { logInfo } from "../../logger";
import type { Contact } from "../../models/contact";
import { ContactSchema } from "../../models/contact";
import { TerminalError, ValidationError } from "../../models/errors";

/* Key prefix of the idempotency pointer rows (16-resident-action-models.md §3.1); never a valid contact_id. */
const POINTER_PREFIX = "CRID#";

/* Storage-only shape of a pointer row; no other layer sees it. */
const ContactPointerSchema = z.object({
  contact_id: z.string().startsWith(POINTER_PREFIX),
  target_contact_id: z.string().min(1),
  created_at: z.string().min(1),
});

export interface CreateContactResult {
  contact: Contact;
  /** True when `client_request_id` was already used and the original Contact came back instead. */
  replayed: boolean;
}

export class ContactDao extends Dao<Contact> {
  constructor(client: DynamoDBDocumentClient, tableName: string) {
    super(client, tableName, ContactSchema, "contact_id");
  }

  /** One Contact by id, or `null`. A pointer key is never a Contact, so it reads as missing. */
  async getContact(contactId: string): Promise<Contact | null> {
    if (contactId.startsWith(POINTER_PREFIX)) {
      logInfo("ContactDao.getContact.pointerKeyRejected", { table: this.tableName, contactId });
      return null;
    }
    return this.getItem(contactId);
  }

  /**
   * Writes the Contact and, when it has a `client_request_id`, its pointer
   * row, in one transaction, each conditioned on not existing. A taken
   * pointer means a retry: the original Contact is returned instead.
   *
   * @throws {@link TerminalError} if the transaction fails for any other reason.
   */
  async createContact(contact: Contact): Promise<CreateContactResult> {
    const validated = this.validate(contact);
    const pointerKey = validated.client_request_id ? `${POINTER_PREFIX}${validated.client_request_id}` : null;
    logInfo("ContactDao.createContact", { table: this.tableName, contactId: validated.contact_id, pointerKey });

    const transactItems = [
      {
        Put: {
          TableName: this.tableName,
          Item: validated,
          ConditionExpression: "attribute_not_exists(contact_id)",
        },
      },
      ...(pointerKey
        ? [
            {
              Put: {
                TableName: this.tableName,
                Item: { contact_id: pointerKey, target_contact_id: validated.contact_id, created_at: validated.created_at },
                ConditionExpression: "attribute_not_exists(contact_id)",
              },
            },
          ]
        : []),
    ];

    try {
      await this.client.send(new TransactWriteCommand({ TransactItems: transactItems }));
      return { contact: validated, replayed: false };
    } catch (err) {
      if (!(err instanceof TransactionCanceledException)) throw err;
      const pointerTaken = pointerKey !== null && err.CancellationReasons?.[1]?.Code === "ConditionalCheckFailed";
      if (!pointerTaken) {
        throw new TerminalError(`Contact create transaction cancelled for ${this.tableName}/${validated.contact_id}`, err);
      }
      const original = await this.getContactByPointer(pointerKey);
      if (!original) {
        throw new TerminalError(`Idempotency pointer ${pointerKey} names no Contact in ${this.tableName}`, err);
      }
      logInfo("ContactDao.createContact.replayed", { table: this.tableName, pointerKey, contactId: original.contact_id });
      return { contact: original, replayed: true };
    }
  }

  private async getContactByPointer(pointerKey: string): Promise<Contact | null> {
    logInfo("ContactDao.getContactByPointer", { table: this.tableName, pointerKey });
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { contact_id: pointerKey }, ConsistentRead: true })
    );
    if (!result.Item) return null;
    const parsed = ContactPointerSchema.safeParse(result.Item);
    if (!parsed.success) {
      throw new ValidationError(`Malformed idempotency pointer ${pointerKey} in ${this.tableName}`, parsed.error.issues);
    }
    return this.getItem(parsed.data.target_contact_id);
  }
}
