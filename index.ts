import {
  AptosClient,
  AptosAccount,
  FaucetClient,
  BCS,
  TxnBuilderTypes,
  Types,
  HexString,
  MaybeHexString,
} from "aptos";
import assert from "assert";

const NODE_URL =
  process.env.APTOS_NODE_URL || "https://fullnode.devnet.aptoslabs.com";
const FAUCET_URL =
  process.env.APTOS_FAUCET_URL || "https://faucet.devnet.aptoslabs.com";

// Address that deployed the module
const SWITCHBOARD_DEVNET_ADDRESS = "BLAHBLAHBLAH";

// Address of the account that owns the Switchboard resource
const SWITCHBOARD_STATE_ADDRESS = "Probable the above";

const {
  AccountAddress,
  TypeTagStruct,
  ScriptFunction,
  StructTag,
  TransactionPayloadScriptFunction,
  RawTransaction,
  ChainId,
} = TxnBuilderTypes;

/**
 * Aggregator
 * init
 * addJob
 * openRound
 *
 * Job
 * init
 *
 * Oracle
 * saveResult
 *
 * Crank
 *
 *
 */

interface AggregatorAddJobParams {
  job: string;
  weight?: number;
}

interface AggregatorInitParams {
  address: MaybeHexString; // arbitrary key associated with aggregator @NOTE: Cannot be altered
  authority: MaybeHexString; // owner of aggregator
  name?: string;
  metadata?: string;
  queueAddress?: MaybeHexString;
  batchSize: number;
  minOracleResults: number;
  minJobResults: number;
  minUpdateDelaySeconds: number;
  startAfter?: number;
  varianceThreshold?: number;
  varianceThresholdScale?: number;
  forceReportPeriod?: number;
  expiration?: number;
}

interface AggregatorSaveResultParams {
  //state_address: address,
  oracle_address: MaybeHexString;
  aggregator_address: MaybeHexString;
  oracle_idx: number;
  error: boolean;
  // this should probably be automatically generated
  value_num: number;
  value_scale_factor: number; // scale factor
  value_neg: boolean;
  jobs_checksum: string;
}

interface AggregatorOpenRoundParams {
  aggregator_address: MaybeHexString;
}

interface JobInitParams {
  address: MaybeHexString;
  name: string;
  metadata: string;
  authority: MaybeHexString;
  data: string;
}

interface AggregatorRemoveJobParams {
  aggregatorAddress: string;
  job: string;
}

interface AggregatorSetConfigParams {
  address: string;
  authority: string;
  name?: string;
  metadata?: string;
  queueAddress?: string;
  batchSize: number;
  minOracleResults: number;
  minJobResults: number;
  minUpdateDelaySeconds: number;
  startAfter?: number;
  varianceThreshold?: number;
  forceReportPeriod?: number;
  expiration?: number;
}

interface CrankInitParams {
  address: string;
  queueAddress: string;
}

interface CrankPopParams {
  crank_address: string;
}

interface CrankPushParams {
  crank_address: string;
  aggregator_address: string;
}

/** Convert string to hex-encoded utf-8 bytes. */
function stringToHex(text: string) {
  return Buffer.from(text, "utf-8").toString("hex");
}

/**
 * Sends and waits for an aptos tx to be confirmed
 * @param client
 * @param signer
 * @param method Aptos module method (ex: 0xSwitchboard::AggregatorAddJobAction)
 * @param args Arguments for method (converts numbers to strings)
 * @returns
 */
async function sendAptosTx(
  client: AptosClient,
  signer: AptosAccount,
  method: string,
  args: Array<any>
): Promise<string> {
  const payload: Types.TransactionPayload = {
    type: "script_function_payload",
    function: method,
    type_arguments: [],
    arguments: args.map((value) =>
      typeof value === "string" ? value : value.toString()
    ),
  };
  const txnRequest = await client.generateTransaction(
    signer.address(),
    payload
  );
  const signedTxn = await client.signTransaction(signer, txnRequest);
  const transactionRes = await client.submitTransaction(signedTxn);
  await client.waitForTransaction(transactionRes.hash);
  return transactionRes.hash;
}

/**
 * Common Constructor
 */
class SwitchboardResource {
  client: AptosClient;
  address: MaybeHexString;
  payer?: AptosAccount;

  constructor(
    client: AptosClient,
    address: MaybeHexString,
    payer?: AptosAccount
  ) {
    this.client = client;
    this.payer = payer;
    this.address = address;
  }
}

export class Aggregator extends SwitchboardResource {
  constructor(
    client: AptosClient,
    address: MaybeHexString,
    payer?: AptosAccount
  ) {
    super(client, address, payer);
  }

  /**
   * Initialize an Aggregator
   * @param client
   * @param payer
   * @param params AggregatorInitParams initialization params
   */
  static async init(
    client: AptosClient,
    payer: AptosAccount,
    params: AggregatorInitParams
  ): Promise<[string, Aggregator]> {
    const tx = await sendAptosTx(
      client,
      payer,
      `${SWITCHBOARD_DEVNET_ADDRESS}::AggregatorInitAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        HexString.ensure(params.address).hex(),
        stringToHex(params.name ?? ""),
        stringToHex(params.metadata ?? ""),
        params.queueAddress
          ? HexString.ensure(params.queueAddress).hex()
          : HexString.ensure("0x0").hex(),
        params.batchSize,
        params.minOracleResults,
        params.minUpdateDelaySeconds,
        params.startAfter ?? 0,
        params.varianceThreshold ?? 0,
        params.varianceThresholdScale ?? 0,
        params.forceReportPeriod ?? 0,
        params.expiration ?? 0,
        HexString.ensure(params.authority).hex(),
      ]
    );

    return [tx, new Aggregator(client, params.address, payer)];
  }

  async addJob(params: AggregatorAddJobParams): Promise<string> {
    if (!this.payer) {
      throw "Add Job Error: No Payer Found";
    }

    return await sendAptosTx(
      this.client,
      this.payer,
      `${SWITCHBOARD_DEVNET_ADDRESS}::AggregatorAddJobAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        HexString.ensure(this.address).hex(),
        HexString.ensure(params.job).hex(),
        params.weight || 0,
      ]
    );
  }

  async saveResult(params: AggregatorSaveResultParams): Promise<string> {
    if (!this.payer) {
      throw "Save Result Error: No Payer Found";
    }

    return await sendAptosTx(
      this.client,
      this.payer,
      `${SWITCHBOARD_DEVNET_ADDRESS}::AggregatorAddJobAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        HexString.ensure(params.oracle_address).hex(),
        HexString.ensure(params.aggregator_address).hex(),
        params.oracle_idx,
        params.value_num,
        params.value_scale_factor,
        params.value_neg,
        stringToHex(params.jobs_checksum),
      ]
    );
  }

  async openRound(params: AggregatorOpenRoundParams): Promise<string> {
    if (!this.payer) {
      throw "Save Result Error: No Payer Found";
    }

    return await sendAptosTx(
      this.client,
      this.payer,
      `${SWITCHBOARD_DEVNET_ADDRESS}::AggregatorAddJobAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        HexString.ensure(params.aggregator_address).hex(),
      ]
    );
  }
}

export class Job extends SwitchboardResource {
  constructor(
    client: AptosClient,
    address: MaybeHexString,
    payer?: AptosAccount
  ) {
    super(client, address, payer);
  }

  /**
   * Initialize a Job stored in the switchboard resource account
   * @param client
   * @param payer
   * @param params JobInitParams initialization params
   */
  static async init(
    client: AptosClient,
    payer: AptosAccount,
    params: JobInitParams
  ): Promise<[string, Job]> {
    /**
     *  state_address: address,
        address: address,
        name: vector<u8>,
        metadata: vector<u8>,
        authority: address,
        data: vector<u8>
     */
    const tx = await sendAptosTx(
      client,
      payer,
      `${SWITCHBOARD_DEVNET_ADDRESS}::JobInitAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        HexString.ensure(params.address).hex(),
        stringToHex(params.name),
        stringToHex(params.metadata),
        HexString.ensure(params.authority).hex(),
        stringToHex(params.data),
      ]
    );

    return [tx, new Job(client, params.address, payer)];
  }
}

export class Crank extends SwitchboardResource {
  constructor(
    client: AptosClient,
    address: MaybeHexString,
    payer?: AptosAccount
  ) {
    super(client, address, payer);
  }

  /**
   * Initialize a Crank stored in the switchboard resource account
   * @param client
   * @param payer account that will be the authority of the Crank
   * @param params CrankInitParams initialization params
   */
  static async init(
    client: AptosClient,
    payer: AptosAccount,
    params: CrankInitParams
  ): Promise<[string, Crank]> {
    const tx = await sendAptosTx(
      client,
      payer,
      `${SWITCHBOARD_DEVNET_ADDRESS}::CrankInitAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        HexString.ensure(params.address).hex(),
        params.queueAddress,
      ]
    );

    return [tx, new Crank(client, params.address, payer)];
  }
}