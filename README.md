# clean_secrets

pnpm i

GOOGLE_APPLICATION_CREDENTIALS=./gcp_secrets_sa_key.json PROJECT="projects/storyscript-ci" DRY_RUN="false" pnpm delete-secrets
