#!/usr/bin/env bash
set -euo pipefail

set_secret() {
  local project=$1 name=$2 value=$3
  printf '%s' "$value" | npx -y firebase-tools@latest apphosting:secrets:set "$name" \
    --project "$project" --data-file - --force
}

grant_secrets() {
  local project=$1 backend=$2
  npx -y firebase-tools@latest apphosting:secrets:grantaccess \
    firebaseApiKey,firebaseAuthDomain,firebaseProjectId,firebaseStorageBucket,firebaseMessagingSenderId,firebaseAppId \
    --project "$project" --backend "$backend" --location us-central1
}

setup_project() {
  local project=$1 backend=$2 api_key=$3 auth_domain=$4 storage_bucket=$5 sender_id=$6 app_id=$7
  echo "Setting App Hosting secrets for $project ($backend)..."
  set_secret "$project" firebaseApiKey "$api_key"
  set_secret "$project" firebaseAuthDomain "$auth_domain"
  set_secret "$project" firebaseProjectId "$project"
  set_secret "$project" firebaseStorageBucket "$storage_bucket"
  set_secret "$project" firebaseMessagingSenderId "$sender_id"
  set_secret "$project" firebaseAppId "$app_id"
  grant_secrets "$project" "$backend"
  echo "Done: $project"
}

setup_project visitation-fg-site visitationfg \
  "AIzaSyChCnIwjZKAyX4Ulp-cSSZ5bxtERP9ZnIo" \
  "visitation-fg-site.firebaseapp.com" \
  "visitation-fg-site.firebasestorage.app" \
  "352953409004" \
  "1:352953409004:web:79020c99f1b60654dbf4c9"

setup_project st-edward-np-site stedwardnp \
  "AIzaSyBGeqd2qHrxpr3totNVm7LuekQY95224eU" \
  "st-edward-np-site.firebaseapp.com" \
  "st-edward-np-site.firebasestorage.app" \
  "889996307131" \
  "1:889996307131:web:8df6e36f782602c423179e"

setup_project sfa-roy-parish-site sfaroy \
  "AIzaSyB0Y1HsufM7feIuRz_sfRP-1GOeakkWpJA" \
  "sfa-roy-parish-site.firebaseapp.com" \
  "sfa-roy-parish-site.firebasestorage.app" \
  "899938360166" \
  "1:899938360166:web:b9612265dc902ae1d646a7"
