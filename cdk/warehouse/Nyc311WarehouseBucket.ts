import { Duration, RemovalPolicy } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311WarehouseBucketProps {
  envName: Nyc311Environment;
}

/**
 * The S3 landing zone for the data warehouse (`7-data-warehousing.md`
 * §5) — one bucket per environment. Firehose writes Parquet under
 * `data/<table>/dt=<date>/`, its error output under `errors/`, and Athena
 * query results under `athena-results/`. `RETAIN` in every environment,
 * SSE-S3, block-all-public, SSL-only.
 */
export class Nyc311WarehouseBucket extends Construct {
  public readonly bucket: s3.Bucket;
  /** The literal, env-suffixed bucket name — usable in S3 URIs without a CFN token. */
  public readonly bucketName: string;

  constructor(scope: Construct, id: string, props: Nyc311WarehouseBucketProps) {
    super(scope, id);

    this.bucketName = `nyc311-warehouse-${ENV_NAME_SUFFIX[props.envName].toLowerCase()}`;

    this.bucket = new s3.Bucket(this, "Bucket", {
      bucketName: this.bucketName,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: false,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: "raw-to-glacier-ir",
          prefix: "data/",
          transitions: [{ storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL, transitionAfter: Duration.days(180) }],
        },
        {
          id: "expire-athena-results",
          prefix: "athena-results/",
          expiration: Duration.days(30),
        },
      ],
    });
  }
}
