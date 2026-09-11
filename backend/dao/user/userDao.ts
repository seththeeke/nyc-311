import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { Dao } from "../dao";
import { logInfo } from "../../logger";
import type { User } from "../../models/user";
import { UserSchema } from "../../models/user";

const COGNITO_SUB_INDEX = "gsi1-cognito-sub";

/**
 * Backs `User` (`data-model.md#user`, `ddb-design.md`'s Users table) — a
 * plain record, not event-sourced. `9-admin-auth-integration.md` §5.
 */
export class UserDao extends Dao<User> {
  constructor(client: DynamoDBDocumentClient, tableName: string) {
    super(client, tableName, UserSchema, "user_id");
  }

  /** Direct lookup by `user_id`. */
  async getUser(userId: string): Promise<User | null> {
    return this.getItem(userId);
  }

  /**
   * Login-path lookup — resolves a Cognito-authenticated request's `sub`
   * claim to the internal `User` record, via `gsi1-cognito-sub`
   * (`ddb-design.md`). Returns `null` if no `User` has been created for
   * this `sub` yet (first-ever login).
   */
  async getUserByCognitoSub(cognitoSub: string): Promise<User | null> {
    logInfo("UserDao.getUserByCognitoSub", { table: this.tableName, cognitoSub });
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: COGNITO_SUB_INDEX,
        KeyConditionExpression: "gsi1pk = :cognitoSub",
        ExpressionAttributeValues: { ":cognitoSub": cognitoSub },
        Limit: 1,
      })
    );
    const item = (result.Items ?? [])[0];
    return item ? this.validate(item) : null;
  }

  /**
   * Creates or overwrites the `User` row for `user`. `additionalAttributes`
   * stamps `gsi1pk = cognito_sub` so `getUserByCognitoSub` can find it —
   * kept off `UserSchema` itself, same pattern as every other sparse GSI
   * key in this codebase.
   */
  async putUser(user: User): Promise<void> {
    await this.putItem(user, { additionalAttributes: { gsi1pk: user.cognito_sub } });
  }
}
