import { existsSync } from "fs";
import path from "path";

import Safe, { SafeAccountConfig, SafeFactory } from "@gnosis.pm/safe-core-sdk";
import { OperationType, SafeTransactionData, SafeTransactionDataPartial } from "@gnosis.pm/safe-core-sdk-types";
import SafeSignature from "@gnosis.pm/safe-core-sdk/dist/src/utils/signatures/SafeSignature";
import SafeTransaction from "@gnosis.pm/safe-core-sdk/dist/src/utils/transactions/SafeTransaction";
import EthersAdapter from "@gnosis.pm/safe-ethers-lib";
import { utils } from "@renproject/utils";
import Axios from "axios";
import chalk from "chalk";
import { getAddress as Ox } from "ethers/lib/utils";
import { mkdir, readFile, writeFile } from "fs/promises";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { OrderedMap } from "immutable";

import { ConsoleInterface, setupWaitForTx } from "./general";

// TYPES ///////////////////////////////////////////////////////////////////////

/**
 * Each network has a MultisigConfig file to track the deploment of a Multisig
 * to that network as well as any queued transactions.
 */
export interface MultisigConfig {
    /**
     * The name of the network (e.g. "ethereumTestnet", "optimismMainnet")
     */
    network: string;

    /**
     * The address of the Multisig deployment.
     */
    address: string | undefined;

    /**
     * An array of queued transactions that need to be signed by the required
     * quorum of signers and executed. Transactions must be executed in the
     * order of their nonces.
     */
    queuedTransactions: Array<{
        data: SafeTransactionData;
        signatures: Array<{
            readonly signer: string;
            readonly data: string;
        }>;
    }>;
}

// The interface for the safe.global API.
interface SafeAPI {
    Propose: {
        Request: {
            to: string;
            value: string;
            data: string;
            operation: OperationType;
            nonce: string;
            safeTxGas: string;
            baseGas: string;
            gasPrice: string;
            gasToken: string;
            refundReceiver: string;
            safeTxHash: string;
            sender: string;
            origin: string | null;
            signature: string;
        };
        Response: {
            id: string;
            timestamp: number;
            txStatus: string; // "AWAITING_EXECUTION";
            txInfo: {
                type: string; // "Custom";
                to: {
                    value: string;
                };
                dataSize: string;
                value: string;
                methodName: string | null;
                isCancellation: boolean;
            };
            executionInfo: {
                type: string; // "MULTISIG";
                nonce: number;
                confirmationsRequired: number;
                confirmationsSubmitted: number;
            };
        };
    };

    Queue: {
        Response: {
            next: string | undefined;
            prev: string | undefined;
            results: Array<{
                type: "TRANSACTION" | "LABEL";
                transaction: SafeAPI["Propose"]["Response"];
            }>;
        };
    };

    Transaction: {
        Response: {
            safeAddress: string; // "0xb6Aa82Db4c7dA3B30eaC3fD395A7dD2215f6773E";
            txId: string; // "multisig_0xb6...";
            executedAt: null;
            txStatus: string; // "AWAITING_EXECUTION";
            txInfo: SafeAPI["Propose"]["Response"]["txInfo"];
            txData: {
                hexData: string; // "0x01020304";
                dataDecoded: null;
                to: { value: string };
                value: string; // "1";
                operation: OperationType;
            };
            detailedExecutionInfo: {
                type: string; //"MULTISIG";
                submittedAt: number; // 1665978427763;
                nonce: number; // 6;
                safeTxGas: string; // "0";
                baseGas: string; // "0";
                gasPrice: string; // "0";
                gasToken: string; // "0x0000000000000000000000000000000000000000";
                refundReceiver: { value: string }; // { value: "0x0000000000000000000000000000000000000000" };
                safeTxHash: string; // "0x8945482864f5a81060a634c99ed8f4c8954599c9be3a05e4a7cc16c08bd4e148";
                executor: null;
                signers: [{ value: string }]; //  [{ value: "0x1111538e6a1657a4cd58Be1CCc13Da0c979e0e5C" }];
                confirmationsRequired: number;
                confirmations: [
                    {
                        signer: { value: string }; // { value: "0x1111538e6a1657a4cd58Be1CCc13Da0c979e0e5C" };
                        signature: string; // "0xe21bf0201c72712fde750c8c4e5c628bb40638ea682179a790d5a2775193a1db6bdfaffed6d6ec7e902ada82aa6519070085b9696ff97ac81b31aff581781abb20";
                        submittedAt: number; // 1665978427796;
                    }
                ];
            };
            txHash: null;
        };
    };
}

////////////////////////////////////////////////////////////////////////////////

export class Multisig {
    network: string;
    logger: ConsoleInterface;
    chainId: number;

    safeSdk: Safe | undefined;
    hre: HardhatRuntimeEnvironment;

    chainIsSupported: boolean | undefined;

    constructor(hre: HardhatRuntimeEnvironment, network: string, chainId: number, logger: ConsoleInterface) {
        this.network = network;
        this.logger = logger;
        this.hre = hre;
        this.chainId = chainId;
    }

    load = async () => {
        const { getNamedAccounts, ethers } = this.hre;

        const { deployer } = await getNamedAccounts();
        // const waitForTx = setupWaitForTx(logger);

        const deployerSigner = await ethers.getSigner(deployer);
        // const multisigDeployerSigner = await ethers.getSigner(multisigDeployer);

        const multisigConfig = await this.readMultisigConfig();

        const ethAdapter = new EthersAdapter({ ethers, signer: deployerSigner });

        if (!multisigConfig.address) {
            return undefined;
        }

        this.safeSdk = await Safe.create({ ethAdapter, safeAddress: multisigConfig.address });

        const queue = await this.fetchQueue();
        if (queue.length) {
            this.logger.log(`${queue.length} pending multisig transactions.`);
        }

        return this;
    };

    deploy = async (owners: string[], threshold: number) => {
        const { getNamedAccounts, ethers } = this.hre;

        const { deployer } = await getNamedAccounts();
        // const waitForTx = setupWaitForTx(logger);

        const deployerSigner = await ethers.getSigner(deployer);
        // const multisigDeployerSigner = await ethers.getSigner(multisigDeployer);

        const multisigConfig = await this.readMultisigConfig();

        let safeSdk: Safe;
        const ethAdapter = new EthersAdapter({ ethers, signer: deployerSigner });

        // Deploy MultiSig ////////////////////////////////////////////////
        if (!multisigConfig.address) {
            try {
                const safeFactory = await SafeFactory.create({ ethAdapter });

                if (threshold < 1 || threshold > owners.length) {
                    throw new Error(`Invalid threshold ${threshold} - must be between 1 and ${owners.length}`);
                }
                const safeAccountConfig: SafeAccountConfig = {
                    owners,
                    threshold,
                    // ...
                };

                safeSdk = await safeFactory.deploySafe({ safeAccountConfig });
            } catch (error) {
                if (error instanceof Error && error.message.match(/Invalid SafeProxyFactory contract address/)) {
                    this.logger.log(`Multisig not supported on ${this.network}.`);
                    return undefined;
                } else {
                    throw error;
                }
            }
            multisigConfig.address = safeSdk.getAddress();
            await this.writeMultisigConfig(multisigConfig);

            this.logger.log(`${chalk.green(`Safe deployed to`)} ${chalk.blue(multisigConfig.address)}`);
        } else {
            safeSdk = await Safe.create({ ethAdapter, safeAddress: multisigConfig.address });
        }

        this.safeSdk = safeSdk;
        return this;
    };

    /**
     * Returns the address of the network's Multisig config file, creating the
     * containing directory if it doesn't exist.
     */
    getMultisigConfigPath = async (): Promise<string> => {
        const deploymentPath = `./deployments/${this.network}/multisig`;
        if (!existsSync(deploymentPath)) {
            await mkdir(deploymentPath, { recursive: true });
        }
        return path.join(deploymentPath, "multisig.json");
    };

    /**
     * Reads the network's Multisig config, returning an empty config if the config
     * file doesn't exist.
     */
    readMultisigConfig = async (): Promise<MultisigConfig> => {
        const configPath = await this.getMultisigConfigPath();
        if (!existsSync(configPath)) {
            return {
                network: this.network,
                address: undefined,
                queuedTransactions: [],
            };
        }
        const config = JSON.parse((await readFile(configPath)).toString());
        return {
            ...{
                network: this.network,
                address: undefined,
                queuedTransactions: [],
            },
            ...config,
        };
    };

    /**
     * Saves the network's Multisig config file.
     */
    writeMultisigConfig = async (config: MultisigConfig): Promise<void> => {
        if (config.network !== this.network) {
            throw new Error(`Invalid MultisigConfig: expected network ${config.network} to be ${this.network}.`);
        }

        const configPath = await this.getMultisigConfigPath();
        const filledConfig: MultisigConfig = {
            ...{
                network: this.network,
                address: undefined,
                queuedTransactions: [],
            },
            ...config,
        };

        await writeFile(configPath, JSON.stringify(filledConfig, null, "    "));
    };

    safeClientUrl = (): string => {
        if (this.chainId === 250) {
            // Fantom
            return `https://safe.fantom.network/v1/chains/${this.chainId}`;
        } else {
            return `https://safe-client.gnosis.io/v1/chains/${this.chainId}`;
        }
    };

    safeAppUrl = (): string | undefined => {
        const networkKey: { [network: string]: string } = {
            ethereumMainnet: "eth",
            polygonMainnet: "matic",
            bscMainnet: "bnb",
            arbitrumMainnet: "arb1",
            avalancheMainnet: "avax",
            optimismMainnet: "oeth",
            goerliTestnet: "gor",
            fantomMainnet: "ftm",
        };

        if (!networkKey[this.network]) {
            return undefined;
        }

        if (this.chainId === 250) {
            // Fantom
            return `https://safe.fantom.network/${networkKey[this.network]}:${this.getAddress()}`;
        } else {
            return `https://gnosis-safe.io/app/${networkKey[this.network]}:${this.getAddress()}`;
        }
    };

    // Check that the chain is supported by the API.
    chainIsSupportedByAPI = async (): Promise<boolean> => {
        if (typeof this.chainIsSupported === "boolean") {
            return this.chainIsSupported;
        }

        try {
            const response = await Axios.get<{ chainId: string }>(this.safeClientUrl());
            if (response.data.chainId !== this.chainId.toString()) {
                throw new Error(`Expected Safe API to return chainId ${this.chainId}.`);
            }
            this.chainIsSupported = true;
            return this.chainIsSupported;
        } catch (error: unknown) {
            if (Axios.isAxiosError(error) && error.response?.status === 404) {
                this.chainIsSupported = false;
                return this.chainIsSupported;
            }
            throw error;
        }
    };

    // Fetch the transaction queue from the Safe API.
    fetchAPIQueue = async (): Promise<SafeTransaction[]> => {
        if (!this.safeSdk) {
            throw new Error(`Must call .load()`);
        }

        const safeAddress = this.safeSdk.getAddress();

        if (!(await this.chainIsSupportedByAPI())) {
            return [];
        }

        let unprocessedRemoteQueue: Array<SafeAPI["Propose"]["Response"]> = [];
        let cursor;
        do {
            // Try fetching the data 5 times. If the response is 404 then the API might not support the chain.
            const { data } = await utils.tryNTimes(
                () =>
                    Axios.get<SafeAPI["Queue"]["Response"]>(
                        `${this.safeClientUrl()}/safes/${safeAddress}/transactions/queued`
                    ),
                2
            );
            cursor = data.next;
            unprocessedRemoteQueue = [
                ...unprocessedRemoteQueue,
                ...data.results.filter((tx) => tx.type === "TRANSACTION").map((tx) => tx.transaction),
            ];
        } while (cursor);

        const remoteQueue: SafeTransaction[] = (
            await Promise.all(
                unprocessedRemoteQueue.map(
                    async (tx) =>
                        (
                            await Axios.get<SafeAPI["Transaction"]["Response"]>(
                                `${this.safeClientUrl()}/transactions/${tx.id}`
                            )
                        ).data
                )
            )
        ).map((tx) => {
            const safeTransaction = new SafeTransaction({
                to: tx.txData.to.value,
                value: tx.txData.value,
                data: tx.txData.hexData,
                operation: tx.txData.operation,
                baseGas: parseInt(tx.detailedExecutionInfo.baseGas),
                gasPrice: parseInt(tx.detailedExecutionInfo.gasPrice),
                gasToken: tx.detailedExecutionInfo.gasToken,
                refundReceiver: tx.detailedExecutionInfo.refundReceiver.value,
                nonce: tx.detailedExecutionInfo.nonce,
                safeTxGas: parseInt(tx.detailedExecutionInfo.safeTxGas),
            });

            for (const signature of tx.detailedExecutionInfo.confirmations) {
                safeTransaction.addSignature(new SafeSignature(signature.signer.value, signature.signature));
            }
            return safeTransaction;
        });

        return remoteQueue;
    };

    // Fetches the transaction queue from the API and combines it with the local queue.
    fetchQueue = async (): Promise<SafeTransaction[]> => {
        if (!this.safeSdk) {
            throw new Error(`Must call .deployOrLoad()`);
        }

        const [config, remoteQueue, nextNonce] = await Promise.all([
            this.readMultisigConfig(),
            this.fetchAPIQueue(),
            this.safeSdk.getNonce(),
        ]);

        // Convert local queue to SafeTransaction array.
        const localQueue = config.queuedTransactions.map(({ data, signatures }) => {
            const tx = new SafeTransaction(data);
            for (const signature of signatures) {
                tx.addSignature(new SafeSignature(signature.signer, signature.data));
            }
            return tx;
        });

        let queueMap = remoteQueue.reduce(
            (map, tx) => map.set(tx.data.nonce, tx),
            OrderedMap<number, SafeTransaction>()
        );

        const chainIsSupported = await this.chainIsSupportedByAPI();

        for (const localTx of localQueue) {
            if (localTx.data.nonce >= nextNonce && !queueMap.has(localTx.data.nonce)) {
                queueMap = queueMap.set(localTx.data.nonce, localTx);
                if (chainIsSupported) {
                    await this.submitTransactionToAPI(localTx);
                }
            }
        }

        const queue = queueMap.valueSeq().toArray();

        // Update config.
        await this.writeMultisigConfig({
            ...config,
            queuedTransactions: queue.map(({ data, signatures }) => ({
                data,
                signatures: Array.from(signatures.values()),
            })),
        });

        return queue;
    };

    submitTransactionToAPI = async (safeTransaction: SafeTransaction) => {
        if (!this.safeSdk) {
            throw new Error(`Must call .deployOrLoad()`);
        }

        const safeAddress = this.safeSdk.getAddress();

        const safeTxHash = await this.safeSdk.getTransactionHash(safeTransaction);

        const signature = safeTransaction.signatures.values().next().value;

        const request: SafeAPI["Propose"]["Request"] = {
            ...safeTransaction.data,
            nonce: safeTransaction.data.nonce.toString(),
            safeTxGas: safeTransaction.data.safeTxGas.toString(),
            baseGas: safeTransaction.data.baseGas.toString(),
            gasPrice: safeTransaction.data.gasPrice.toString(),
            safeTxHash,
            sender: signature.signer,
            origin: null,
            signature: signature.data,
        };

        return await Axios.post<unknown, SafeAPI["Propose"]["Request"]>(
            `${this.safeClientUrl()}/transactions/${safeAddress}/propose`,
            request,
            {}
        );
    };

    saveTransaction = async (safeTransaction: SafeTransaction) => {
        if (await this.chainIsSupportedByAPI()) {
            await this.submitTransactionToAPI(safeTransaction);
        }

        const config = await this.readMultisigConfig();
        await this.writeMultisigConfig({
            ...config,
            queuedTransactions: [
                ...config.queuedTransactions,
                {
                    data: safeTransaction.data,
                    signatures: Array.from(safeTransaction.signatures.values()),
                },
            ],
        });

        return safeTransaction;
    };

    proposeTransaction = async (tx: SafeTransactionDataPartial): Promise<SafeTransaction> => {
        if (!this.safeSdk) {
            throw new Error(`Must call .deployOrLoad()`);
        }

        const queue = await this.fetchQueue();
        const nextNonce = queue.reduce<number | undefined>(
            (acc, tx) => Math.max(acc || 0, tx.data.nonce + 1),
            undefined
        );

        for (const queuedTx of queue) {
            if (queuedTx.data.data === tx.data && queuedTx.data.to.toLowerCase() === tx.to.toLowerCase()) {
                console.log(`Already proposed.`);
                return queuedTx;
            }
        }

        const safeTransaction = await this.safeSdk.createTransaction({
            safeTransactionData: { ...tx, nonce: nextNonce },
        });
        const safeTxHash = await this.safeSdk.getTransactionHash(safeTransaction);

        const signature = await this.safeSdk.signTransactionHash(safeTxHash);

        safeTransaction.addSignature(signature);

        return await this.saveTransaction(safeTransaction);
    };

    /**
     * A transaction can be executed if it has received the required number
     * of signatures and its nonce matches the Multisig's current nonce.
     */
    transactionSigned = async (safeTransaction: SafeTransaction) => {
        if (!this.safeSdk) {
            throw new Error(`Must call .deployOrLoad()`);
        }

        const threshold = await this.safeSdk.getThreshold();
        const signatureCount = safeTransaction.signatures.size;

        return signatureCount >= threshold;
    };

    transactionNextInQueue = async (safeTransaction: SafeTransaction) => {
        if (!this.safeSdk) {
            throw new Error(`Must call .deployOrLoad()`);
        }

        const nextNonce = await this.safeSdk.getNonce();

        return safeTransaction.data.nonce === nextNonce;
    };

    executeTransaction = async (safeTransaction: SafeTransaction) => {
        if (!this.safeSdk) {
            throw new Error(`Must call .deployOrLoad()`);
        }

        const tx = await this.safeSdk.executeTransaction(safeTransaction);

        if (!tx.transactionResponse) {
            throw new Error(`Expected transaction response to be returned from Safe SDK.`);
        }

        const waitForTx = setupWaitForTx(this.logger);
        await waitForTx(tx.transactionResponse);

        // Synchronise local and remote queues.
        await this.fetchQueue();
    };

    getAddress = () => {
        if (!this.safeSdk) {
            throw new Error(`Must call .deployOrLoad()`);
        }

        return this.safeSdk.getAddress();
    };

    getMultisigRules = async (): Promise<{ signers: string[]; threshold: number }> => {
        if (!this.safeSdk) {
            throw new Error(`Must call .deployOrLoad()`);
        }
        const signers = (await this.safeSdk.getOwners()).map((a) => Ox(a)).sort();
        const threshold = await this.safeSdk.getThreshold();

        return {
            signers,
            threshold,
        };
    };

    getTransactionLink = async (transaction?: SafeTransaction): Promise<string | undefined> => {
        const baseLink = this.safeAppUrl();

        if (!baseLink) {
            return undefined;
        }

        if (!transaction) {
            return baseLink;
        }

        const hash = await this.safeSdk?.getTransactionHash(transaction);

        return `${baseLink}/transactions/multisig_${this.getAddress()}_${hash}`;

        // https://gnosis-safe.io/app/gor:0xb6Aa82Db4c7dA3B30eaC3fD395A7dD2215f6773E/transactions/multisig_0xb6Aa82Db4c7dA3B30eaC3fD395A7dD2215f6773E_0xb5f947719a682d114eac5e99a889f6575e4d194b7a5ad11ffc91061c3234e851
    };
}

/* Old code for deploying from a seperate account. */
// console.log(JSON.stringify(signedData));

// console.log(await safeSdk.executeTransaction(signedData));

// const balanceAfter = await ethers.provider.getBalance(multisigDeployer);
// const returnGasPrice = await ethers.provider.getGasPrice();
// const returnTxFee = returnGasPrice.mul(21000);
// if (balanceAfter.gt(returnTxFee)) {
//     await waitForTx(
//         await multisigDeployerSigner.sendTransaction({
//             to: deployer,
//             value: balanceAfter.sub(returnTxFee),
//             gasPrice: returnGasPrice,
//         }),
//         "Returning funds from Multisig Deployer"
//     );
// }

const func: DeployFunction = async function () {};
func.tags = [];
export default func;
