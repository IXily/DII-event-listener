import { ethers } from "ethers";

import * as config from "../config/config";

import {
    EventEmitterModule as EventEmitter,
    EventType
} from '../modules/event-emitter.module';

/* events */
import { newIdeaNFTEvent } from "./events/new-idea-nft";
import { notification } from "./events/notification";
import { orderStore } from "./events/order-store";

/* helpers */
import { rest } from "../helpers/helpers";

/* utils */
import { getRpcUrlByNetwork } from "../utils/utils";

/* interfaces */
import { INewIdeaNFT } from '../interfaces/new-idea-nft.i';
import { ID2EventListenerPayload } from "../interfaces/shared.i";
import { INotificationPayload } from "../interfaces/notification.i";
import { IOrderStorePayload } from "../interfaces/order.i";

let watcherLoaded = false;

const mode = config.APP_ENV;

const WALLET_NETWORK_CHAIN_IDS_OPTS = {
    goerli: 5,
    hardhat: 1337,
    kovan: 42,
    ethereum: 1,
    rinkeby: 4,
    ropsten: 3,
    maticmum: 0xa4ec,
    sepolia: 11155111,
    polygon: 137,
    mumbai: 80001,
    bnb: 56,
};

export const D2EventListener = async (
    payload: ID2EventListenerPayload
) => new Promise<any>(async (resolve, reject) => {
    try {

        // watch and process events
        watcherLoader(payload, resolve);

        const { privateKey, network } = payload;

        const {
            contract,
            rpcUrl,
            wallet,
        } = contractHandler({
            privateKey,
            network,
        });

        log(`Private key detected (${privateKey})`);
        log(`Address: ${wallet.address}`);

        log(`Listening the events flow...`);

        const events = getEventFiltered(contract);

        log('');

        const isAUnitTest = payload?.test?.enabled;

        if (!isAUnitTest) {
            events?.map((key) => {
                contract.on(key, async (...args) => {
                    if (key === 'IdeaCreated') {
                        await EventEmitter().emit<INewIdeaNFT>(
                            'NEW_IDEA_NFT',
                            {
                                contract,
                                network,
                                rpcUrl,
                                blockNumber: args[6]?.blockNumber,
                            }
                        );
                    };
                });
            });

            resolve(true);
        }

        if (isAUnitTest) {
            await rest(1000);

            EventEmitter().emit<INewIdeaNFT>(
                'NEW_IDEA_NFT',
                {
                    contract,
                    network,
                    rpcUrl,
                    blockNumber: payload.test.blockNumber,
                }
            );
        }

    } catch (err) {
        reject(err);
    }
});

const log = (
    message?: any, ...optionalParams: any[]
) => {
    // if (mode === 'production') return;
    console.log(message, ...optionalParams);
};

const contractHandler = (
    payload: ID2EventListenerPayload
) => {
    const {
        privateKey,
        network,
    } = payload;

    const rpcUrl = getRpcUrlByNetwork(network);

    const networkChainId = WALLET_NETWORK_CHAIN_IDS_OPTS[network] || -1;

    if (networkChainId === -1) throw new Error(`Invalid network: ${network}`);
    if (!privateKey) throw new Error(`Private key is not defined`);

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl, networkChainId);

    const wallet = new ethers.Wallet(
        privateKey,
        provider,
    );

    const signer = wallet.connect(provider);

    const contract = new ethers.Contract(
        config.IDEA_NFT_CONFIG.gateContractAddress,
        config.IDEA_NFT_CONFIG.gateAbi,
        signer
    );

    return {
        contract,
        rpcUrl,
        wallet,
    };
}

const watcherLoader = (
    payload: ID2EventListenerPayload,
    // used to finish the unit test promise
    resolve?: any,
) => {
    // watcher process
    try {
        if (!watcherLoaded) {
            EventEmitter().listen().subscribe(async (res) => {
                const event = res.type as EventType;
                const data = res?.data || null;

                // event selector
                switch (event) {
                    case 'NEW_IDEA_NFT':
                        const response = await newIdeaNFTEvent(data as INewIdeaNFT);
                        if (payload?.test?.enabled) {
                            return resolve(response);
                        };
                        break;
                    case 'NOTIFICATION':
                        await notification(data as INotificationPayload);
                        break;
                    case 'ORDER_STORE':
                        await orderStore(data as IOrderStorePayload);
                        break;
                };

            });
            watcherLoaded = true;
        }
    } catch (err) {
        console.log('Watcher Error: ', err?.message);
    }
}

const getEventFiltered = (contract: ethers.Contract) => {
    let events = Object.keys(contract.filters);

    events = events.map((key) => {
        key = (key.split('(')[0]);
        return key;
    });

    events = [...new Set(events)];

    events = events.filter((key) => {
        return key !== 'Initialized';
    });

    if (events?.length > 0) {
        log(`Events to listen: ${events.join(', ')}`);
    }

    if (events?.length <= 0) {
        log(`No events found`);
    }

    return events;
};