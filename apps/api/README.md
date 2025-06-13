# MedApp API

> A feathersjs API for managing medical appointments and patient data.

This project uses two types of encryption:

1. Non-deterministic encryption of medical records using [pgcrypto](https://www.postgresql.org/docs/current/pgcrypto.html).
2. Deterministic encryption for sensitive but queryable data such as national IDs, first and last names, and health insurance numbers among others.

For encryption to work, the `ENCRYPTION_KEY` environment variable must be set. You can generate a key with the following command:

```bash
openssl rand -base64 32
```

Keep this key in a secure location as it will be required to decrypt the data.

## Data Migration Scripts

This repository includes scripts for migrating data from legacy MongoDB databases to the new system.

### Pulling Data (`scripts/pull-data.sh`)

This script pulls MongoDB collections from two different sources:

1. A remote MongoDB server accessed via SSH
2. A MongoDB Atlas cluster

#### Usage:

```bash
./scripts/pull-data.sh -u <mongodb_username> -w <mongodb_password> [-p <ssh_port>] [-m <mongodb_port>] -a <atlas_password>
```

#### Options:

- `-u`: MongoDB username
- `-w`: MongoDB password
- `-p`: SSH port (default: 22)
- `-m`: MongoDB port (default: 27017)
- `-a`: MongoDB Atlas password

### Importing Data (`scripts/import-mongo-dumps.ts`)

This script imports data from MongoDB dumps into the new system. This requires data being pulled from the remote server using the `pull-data.sh` script. It will erase all data in the database before importing.

#### Usage:

```bash
npx ts-node scripts/import-mongo-dumps.ts
```
