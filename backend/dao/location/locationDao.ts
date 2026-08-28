import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Dao } from "../dao";
import { logInfo } from "../../logger";
import type { Location } from "../../models/location";
import { LocationSchema } from "../../models/location";
import { TerminalError } from "../../models/errors";

export class LocationDao extends Dao<Location> {
  constructor(client: DynamoDBDocumentClient, tableName: string) {
    super(client, tableName, LocationSchema, "location_id");
  }

  /** Plain lookup by id — `6-order-scheduling.md` §3's pool-derivation step needs `borough`. */
  async getLocation(locationId: string): Promise<Location | null> {
    return this.getItem(locationId);
  }

  /**
   * Dedup-by-`bbl` at intake (`ddb-design.md`'s Locations table design):
   * returns the existing Location if one is already stored under this
   * `bbl`, otherwise creates it. A concurrent creation race is resolved by
   * re-fetching and returning the winner's version rather than erroring.
   */
  async findOrCreateLocation(location: Location): Promise<Location> {
    const existing = await this.getItem(location.location_id);
    if (existing) {
      logInfo("LocationDao.findOrCreateLocation.hit", { table: this.tableName, locationId: location.location_id });
      return existing;
    }
    try {
      await this.putItem(location, { conditionExpression: "attribute_not_exists(location_id)" });
      logInfo("LocationDao.findOrCreateLocation.created", {
        table: this.tableName,
        locationId: location.location_id,
      });
      return location;
    } catch (err) {
      if (err instanceof TerminalError) {
        const winner = await this.getItem(location.location_id);
        if (winner) return winner;
      }
      throw err;
    }
  }
}
