import feathers from '@feathersjs/feathers';
import rest from '@feathersjs/rest-client';
import auth from '@feathersjs/authentication-client';
import axios from 'axios';
import app from '../src/app';

const port = app.get('port') || 3030;
const client = feathers();
const restClient = rest(`http://localhost:${port}`);

client.configure(restClient.axios(axios));
client.configure(auth());

export default client;
