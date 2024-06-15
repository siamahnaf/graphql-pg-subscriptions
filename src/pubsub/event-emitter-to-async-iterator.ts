import { $$asyncIterator } from "iterall";
import { EventEmitter } from "events";
import { Client } from "pg";

type MessageHandler<T> = (message: T) => any;

function eventEmitterAsyncIterator<T>(
    eventEmitter: EventEmitter,
    eventsNames: string | string[],
    commonMessageHandler: MessageHandler<T> = message => message,
    client: Client
) {
    const pullQueue: Array<(value: IteratorResult<any>) => void> = [];
    const pushQueue: any[] = [];
    const eventsArray = typeof eventsNames === "string" ? [eventsNames] : eventsNames;
    let listening = true;

    const pushValue = async ({ payload: event }: { payload: T }) => {
        const query = `SELECT payload FROM pubsub_payloads WHERE id = $1`;
        const res = await client.query(query, [event]);
        const value = commonMessageHandler(res.rows[0].payload);
        if (pullQueue.length !== 0) {
            pullQueue.shift()!({ value, done: false });
        } else {
            pushQueue.push(value);
        }
        const deleteQuery = `DELETE FROM pubsub_payloads WHERE id = $1`;
        await client.query(deleteQuery, [event]);
    };

    const pullValue = () => {
        return new Promise<IteratorResult<any>>(resolve => {
            if (pushQueue.length !== 0) {
                resolve({ value: pushQueue.shift(), done: false });
            } else {
                pullQueue.push(resolve);
            }
        });
    };

    const emptyQueue = () => {
        if (listening) {
            listening = false;
            removeEventListeners();
            pullQueue.forEach(resolve => resolve({ value: undefined, done: true }));
            pullQueue.length = 0;
            pushQueue.length = 0;
        }
    };

    const addEventListeners = () => {
        for (const eventName of eventsArray) {
            eventEmitter.addListener(eventName, pushValue);
        }
    };

    const removeEventListeners = () => {
        for (const eventName of eventsArray) {
            eventEmitter.removeListener(eventName, pushValue);
        }
    };

    addEventListeners();

    return {
        next() {
            return listening ? pullValue() : this.return();
        },
        return() {
            emptyQueue();
            return Promise.resolve({ value: undefined, done: true });
        },
        throw(error: any) {
            emptyQueue();
            return Promise.reject(error);
        },
        [$$asyncIterator]() {
            return this;
        }
    };
}

export {
    eventEmitterAsyncIterator
};
