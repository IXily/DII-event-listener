export interface INotificationPayload {
    type: string,
    info: {
        environment: string;
        credentialNftUUID: string;
        credentialOwner: string;
        nftId: string;
        blockNumber: number;
        data: any;

        error?: string;
        orderId?: string;
        docID?: string;
    }
};