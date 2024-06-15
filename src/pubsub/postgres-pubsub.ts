import { PubSubEngine } from "graphql-subscriptions";
//@ts-ignore
import pgIPC from "pg-ipc";
import { Client, ClientConfig } from "pg";
import { eventEmitterAsyncIterator } from "./event-emitter-to-async-iterator";

const defaultCommonMessageHandler = (message: any) => message;

interface PostgresPubSubOptions extends ClientConfig {
    commonMessageHandler?: (message: any) => any;
    client?: Client;
    maxListeners?: number;
}

class PostgresPubSub extends PubSubEngine {
    private client: Client;
    private ee: pgIPC;
    private subscriptions: { [key: number]: [string, (message: any) => void] };
    private subIdCounter: number;
    private commonMessageHandler: (message: any) => any;

    constructor(options: PostgresPubSubOptions = {}) {
        const { commonMessageHandler, client, maxListeners = 15, ...pgOptions } = options;
        super();
        this.client = client || new Client(pgOptions);
        if (!client) {
            this.client.connect();
        }
        this.ee = new pgIPC(this.client);
        this.ee.setMaxListeners(maxListeners);
        this.subscriptions = {};
        this.subIdCounter = 0;
        this.commonMessageHandler = commonMessageHandler || defaultCommonMessageHandler;
        this.ensureTableExists();
    }

    private async ensureTableExists() {
        await this.client.query(`
            CREATE TABLE IF NOT EXISTS pubsub_payloads (
                id SERIAL PRIMARY KEY,
                trigger VARCHAR(255) NOT NULL,
                payload JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
    }

    async publish(triggerName: string, payload: any): Promise<void> {
        const payloadString = JSON.stringify(payload);
        const result = await this.client.query(
            `INSERT INTO pubsub_payloads (trigger, payload) VALUES ($1, $2) RETURNING id`,
            [triggerName, payloadString]
        );
        const id = result.rows[0].id;
        return this.ee.notify(triggerName, id.toString());
    }

    subscribe(triggerName: string, onMessage: (message: any) => void): Promise<number> {
        const callback = (message: any) => {
            onMessage(
                message instanceof Error
                    ? message
                    : this.commonMessageHandler(message.payload)
            );
        };
        this.ee.on(triggerName, callback);
        this.subIdCounter += 1;
        this.subscriptions[this.subIdCounter] = [triggerName, callback];
        return Promise.resolve(this.subIdCounter);
    }

    async unsubscribe(subId: number): Promise<void> {
        const [triggerName, onMessage] = this.subscriptions[subId];
        delete this.subscriptions[subId];
        this.ee.removeListener(triggerName, onMessage);
    }

    asyncIterator<T>(triggers: string | string[]): AsyncIterator<T> {
        return eventEmitterAsyncIterator(
            this.ee,
            triggers,
            this.commonMessageHandler,
            this.client
        ) as any;
    }
}

export { PostgresPubSub, PostgresPubSubOptions };
