#!/bin/bash

# This script pulls MongoDB collections from two different servers:
# 1. A remote server via SSH using mongoexport
# 2. A MongoDB Atlas cluster using a connection string
#
# Usage:
#   ./pull-data.sh -u <mongodb_username> -w <mongodb_password> [-p <ssh_port>] [-m <mongodb_port>] -a <atlas_password> [-o <origin>]
#
# Required arguments:
#   -u    MongoDB username for remote server
#   -w    MongoDB password for remote server
#   -a    MongoDB Atlas password
#
# Optional arguments:
#   -p    SSH port (defaults to 22)
#   -m    MongoDB port (defaults to 27017)
#   -o    Origin to pull data from: 'do' for DigitalOcean server, 'atlas' for MongoDB Atlas (defaults to both)
#
# Example:
#   ./pull-data.sh -u admin -w secret123 -p 2222 -m 27017 -a atlas_pwd123
#   ./pull-data.sh -o atlas -a atlas_pwd123
#   ./pull-data.sh -o do -u admin -w secret123 -p 2222 -m 27017

# Configuration for remote server
REMOTE_HOST="silvestre@167.99.182.81"
SSH_PORT="22"  # Default SSH port, can be overridden
MONGO_PORT="27017"  # Default MongoDB port, can be overridden
REMOTE_DB="bonder"
COLLECTIONS=("appointment" "encounter" "patient" "user" "licenses")

# Configuration for MongoDB Atlas
ATLAS_URI_BASE="mongodb+srv://silvestre@studies-book-api.5nwv0.mongodb.net/studies"
ATLAS_COLLECTIONS=("results" "studies")

# Get script directory for relative paths
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
OUTPUT_DIR="$SCRIPT_DIR/dumps"

# Parse command line arguments
while getopts "p:u:w:a:m:o:" opt; do
    case $opt in
        p) SSH_PORT="$OPTARG" ;;
        u) MONGO_USER="$OPTARG" ;;
        w) MONGO_PASS="$OPTARG" ;;
        a) ATLAS_PASS="$OPTARG" ;;
        m) MONGO_PORT="$OPTARG" ;;
        o) ORIGIN="$OPTARG" ;;
        \?) echo "Invalid option -$OPTARG" >&2; exit 1 ;;
    esac
done

# Validate origin value if provided
if [ ! -z "$ORIGIN" ] && [ "$ORIGIN" != "do" ] && [ "$ORIGIN" != "atlas" ]; then
    echo "Invalid origin value. Must be 'do' or 'atlas'"
    exit 1
fi

# Validate arguments based on origin
if [ -z "$ORIGIN" ] || [ "$ORIGIN" == "do" ]; then
    if [ -z "$MONGO_USER" ] || [ -z "$MONGO_PASS" ]; then
        echo "MongoDB username (-u) and password (-w) are required for DigitalOcean server"
        exit 1
    fi
fi

if [ -z "$ORIGIN" ] || [ "$ORIGIN" == "atlas" ]; then
    if [ -z "$ATLAS_PASS" ]; then
        echo "MongoDB Atlas password (-a) is required"
        exit 1
    fi
fi

# SSH and SCP options with custom port
SSH_OPTS="-p $SSH_PORT"
SCP_OPTS="-P $SSH_PORT"

# Create local output directory
mkdir -p "$OUTPUT_DIR"

# Run mongoexport for each collection on remote server
if [ -z "$ORIGIN" ] || [ "$ORIGIN" == "do" ]; then
    for collection in "${COLLECTIONS[@]}"; do
        echo "Exporting collection from remote server: $collection"

        # Log the SSH command
        echo "SSH Command:"
        echo "ssh $SSH_OPTS $REMOTE_HOST \"mongoexport \\
        --db=$REMOTE_DB \\
        --collection=$collection \\
        --authenticationDatabase=admin \\
        --username=$MONGO_USER \\
        --password=******* \\
        --port=$MONGO_PORT \\
        --jsonArray \\
        --out=/tmp/${collection}.json\""

        # Execute mongoexport on remote server
        ssh $SSH_OPTS $REMOTE_HOST "mongoexport \\
        --db=$REMOTE_DB \\
        --collection=$collection \\
        --authenticationDatabase=admin \\
        --username=$MONGO_USER \\
        --password=$MONGO_PASS \\
        --port=$MONGO_PORT \\
        --jsonArray \\
        --out=/tmp/${collection}.json"

        # Log the SCP command
        echo "SCP Command:"
        echo "scp $SCP_OPTS \"$REMOTE_HOST:/tmp/${collection}.json\" \"$OUTPUT_DIR/\""

        # Copy the exported file from remote to local
        scp $SCP_OPTS "$REMOTE_HOST:/tmp/${collection}.json" "$OUTPUT_DIR/"

        # Log the cleanup command
        echo "Cleanup Command:"
        echo "ssh $SSH_OPTS $REMOTE_HOST \"rm /tmp/${collection}.json\""

        # Clean up remote temporary file
        ssh $SSH_OPTS $REMOTE_HOST "rm /tmp/${collection}.json"
    done
fi

# Run mongoexport for each collection from MongoDB Atlas
if [ -z "$ORIGIN" ] || [ "$ORIGIN" == "atlas" ]; then
    for collection in "${ATLAS_COLLECTIONS[@]}"; do
        echo "Exporting collection from Atlas: $collection"

        # Construct full URI with password
        ATLAS_URI="${ATLAS_URI_BASE/silvestre/silvestre:$ATLAS_PASS}"

        # Log the Atlas mongoexport command (with hidden password)
        echo "Atlas Command:"
        echo "mongoexport \\
        --uri=\"${ATLAS_URI//$ATLAS_PASS/*******}\" \\
        --collection=\"$collection\" \\
        --jsonArray \\
        --out=\"$OUTPUT_DIR/${collection}.json\""

        # Execute mongoexport locally for Atlas collections
        mongoexport \
        --uri="$ATLAS_URI" \
        --collection="$collection" \
        --jsonArray \
        --out="$OUTPUT_DIR/${collection}.json"
    done
fi

# Pretty print all JSON files using jq
echo "Pretty printing JSON files..."
for json_file in "$OUTPUT_DIR"/*.json; do
    if [ -f "$json_file" ]; then
        echo "Formatting $json_file"
        # Create temporary file for formatted output
        temp_file="${json_file}.temp"
        jq '.' "$json_file" > "$temp_file" && mv "$temp_file" "$json_file"
    fi
done

echo "Export completed. Files are in $OUTPUT_DIR"
