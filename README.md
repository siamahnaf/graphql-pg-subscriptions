# Graphql PG Subscription

A graphql subscriptions implementation using postgres and apollo's graphql-subscriptions.

This package implements the PubSubEngine Interface from the graphql-subscriptions package and also the new AsyncIterator interface. It allows you to connect your subscriptions manger to a postgres based Pub Sub mechanism to support multiple subscription manager instances.


<a href="https://www.buymeacoffee.com/siamahnaf" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

# Features
- Properly Maintained
- Small In Size
- Larger Payload Problem Solved (I use pg table for the payload. So now larger payload can pass) - (PG Default Notify has size limit, that's why you can't provide larger payload.);
- Fully TypeScript Support
- Worked with any framework (ExpressJS, NestJS)

## Installation

```bash
npm i graphql-pg-subscriptions
```

## Usage

First of all, follow the instructions in [graphql-subscriptions](https://github.com/apollographql/graphql-subscriptions) to add subscriptions to your app.

Afterwards replace `PubSub` with `PostgresPubSub`:

```js
// Before
import { PubSub } from "graphql-subscriptions";

export const pubsub = new PubSub();
```

```js
//After
import { PostgresPubSub } from "graphql-postgres-subscriptions";
import { Client } from "pg";

const client = new Client({
    user: 'dbuser',
    host: 'database.server.com',
    database: 'mydb',
    password: 'secretpassword',
    port: 3211,
});

client.connect();

const pubsub = new PostgresPubSub({ client, maxListeners: 15 });

//You can increase max event listeners if you need, default is 15
```

### commonMessageHandler

The second argument to `new PostgresPubSub()` is the `commonMessageHandler`. The common message handler gets called with the received message from PostgreSQL.
You can transform the message before it is passed to the individual filter/resolver methods of the subscribers.
This way it is for example possible to inject one instance of a [DataLoader](https://github.com/facebook/dataloader) which can be used in all filter/resolver methods.

```javascript
const getDataLoader = () => new DataLoader(...)
const commonMessageHandler = ({attributes: {id}, data}) => ({id, dataLoader: getDataLoader()})
const pubsub = new PostgresPubSub({ client, commonMessageHandler });
```

```javascript
export const resolvers = {
  Subscription: {
    somethingChanged: {
      resolve: ({ id, dataLoader }) => dataLoader.load(id)
    }
  }
};
```

## Error handling

`PostgresPubSub` instances emit a special event called `"error"`. This event's payload is an instance of Javascript's `Error`. You can get the error's text using `error.message`.

```js
const ps = new PostgresPubSub({ client });

ps.subscribe("error", err => {
  console.log(err.message); // -> "payload string too long"
}).then(() => ps.publish("a", "a".repeat(9000)));
```

For example you can log all error messages (including stack traces and friends) using something like this:

```js
ps.subscribe("error", console.error);
```

## Stay in touch

- Author - [Siam Ahnaf](https://www.siamahnaf.com/)
- Website - [https://www.siamahnaf.com/](https://www.siamahnaf.com/)
- Twitter - [https://twitter.com/siamahnaf198](https://twitter.com/siamahnaf198)
- Github - [https://github.com/siamahnaf](https://github.com/siamahnaf)
