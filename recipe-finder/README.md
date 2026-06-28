# Recipe Finder - S3 Vector Buckets for GenAI RAG

A CDK port of the architecture described in [AWS Use Case: S3 Vector Buckets - The Game Changer for Building Cost-Effective GenAI Applications](https://medium.com/aws-in-plain-english/aws-use-case-s3-vector-buckets-the-game-changer-for-building-cost-effective-genai-applications-f2ac26ea3cc9). The article builds a restaurant recipe chatbot by hand through the Bedrock console; this stack provisions the same pieces as code and wires the document-upload-to-ingestion step together automatically.

## Use Case

Upload your own recipes (proprietary ones a generic foundation model wouldn't know), then ask natural-language questions about them - e.g. "How much cornstarch goes in the berry sauce?" - and get an answer generated from your documents, not the open internet.

## Architecture

```
POST /recipes ──▶ createRecipe Lambda ──▶ S3 (RecipeDocumentsBucket, recipes/*.txt)
                                                   │
                                       S3 ObjectCreated event
                                                   ▼
                                          ingestRecipe Lambda
                                                   │
                                     bedrock:StartIngestionJob
                                                   ▼
                                       Bedrock Knowledge Base
                                     (Titan Text Embeddings v2)
                                                   │
                                                   ▼
                              S3 Vector Bucket + Vector Index (1024-dim, cosine)

POST /recipes/search ──▶ findRecipe Lambda ──▶ bedrock:RetrieveAndGenerate
                                                   │ (queries the Knowledge Base above,
                                                   │  generates the answer with Claude
                                                   ▼  Sonnet 4.6 via a US inference profile)
                                              answer + source citations
```

- **`RecipeFinderStorage`** ([lib/storage.ts](lib/storage.ts)) - the raw-document S3 bucket plus the S3 Vector bucket/index that stores the embeddings.
- **`RecipeKnowledgeBase`** ([lib/knowledgebase.ts](lib/knowledgebase.ts)) - the Bedrock Knowledge Base (storage type `S3_VECTORS`) and its S3 data source, plus the IAM role Bedrock assumes to read documents and write vectors.
- **`RecipeFinderMicroservices`** ([lib/microservices.ts](lib/microservices.ts)) - the three Lambdas described below, including the S3 -> Lambda event notification that replaces the article's manual "sync data source" console click.
- **`RecipeFinderApiGateway`** ([lib/apigateway.ts](lib/apigateway.ts)) - the REST API in front of them. Also serves a Swagger UI at `GET /docs`, backed by the OpenAPI spec at `GET /docs/openapi.json`.

This intentionally skips the Bedrock *Agent* layer from the article - `bedrock:RetrieveAndGenerate` talks to the Knowledge Base directly with an attached generation model, which is the same RAG mechanism an Agent uses internally, without the extra agent/alias/action-group resources to manage.

### Lambdas

| Lambda | Trigger | Responsibility |
| --- | --- | --- |
| `createRecipe` | `POST /recipes` | Writes the recipe text to `recipes/<uuid>-<slug>.txt` in the documents bucket. |
| `ingestRecipe` | S3 `ObjectCreated` on `recipes/*` | Calls `StartIngestionJob` so the new recipe gets chunked, embedded, and written into the vector index. |
| `findRecipe` | `POST /recipes/search` | Calls `RetrieveAndGenerate` against the Knowledge Base and returns a generated answer with source citations. |
| `docs` | `GET /docs`, `GET /docs/openapi.json` | Serves a Swagger UI page and the OpenAPI spec describing the two endpoints above. |

## Quick Start

### Prerequisites

- An AWS account with access to **Amazon Bedrock** model access enabled for `amazon.titan-embed-text-v2:0` and `anthropic.claude-sonnet-4-6` (Bedrock console -> Model access).
- S3 Vectors is a newer AWS capability - confirm it's available in `us-east-1` for your account before deploying.

```bash
npm install
```

### Deploy

```bash
npx cdk deploy
```

The stack is pinned to `us-east-1` (see [bin/recipe-finder.ts](bin/recipe-finder.ts)) for Bedrock/S3 Vectors availability and the Claude inference profile this stack relies on.

### Try It

```bash
API_URL=$(aws cloudformation describe-stacks --stack-name RecipeFinderStack \
  --query "Stacks[0].Outputs[?OutputKey=='RecipeFinderApiGatewayRecipeFinderApiEndpoint*'].OutputValue" \
  --output text --region us-east-1)

curl -X POST "${API_URL}recipes" \
  -H 'Content-Type: application/json' \
  -d '{"name": "Any Berry Sauce", "content": "Ingredients: 4 cups mixed berries, 1 tbsp cornstarch, 2 tbsp sugar. Instructions: simmer berries and sugar for 5 minutes, stir in cornstarch slurry, cook until thickened."}'

# Wait ~1-2 minutes for the ingestion job to finish embedding the new recipe, then:
curl -X POST "${API_URL}recipes/search" \
  -H 'Content-Type: application/json' \
  -d '{"query": "How much cornstarch goes in the Any Berry Sauce?"}'
```

Or browse the interactive docs at `${API_URL}docs`.

## Known Limitations

- **Ingestion is fire-and-forget.** `ingestRecipe` starts a Bedrock ingestion job per upload; if one is already running, the new request is dropped (logged, not retried) on the assumption the in-flight job's full-prefix scan will pick up the new file anyway. For bursty uploads, poll `GET /knowledgebases/{id}/datasources/{id}/ingestionjobs` before querying.
- **S3 Vector buckets can only be deleted when empty.** `cdk destroy` may fail to remove `RecipeVectorBucket` if it still holds vectors - delete the vectors (or the index) first via the AWS CLI, then re-run destroy.
- **No Agent / conversation memory.** Each `POST /recipes/search` call is a single stateless RAG query; there's no multi-turn session like the article's Bedrock Agent chat console.
- **Model access must be enabled per-account.** Both Bedrock model IDs above need to be explicitly enabled in the deploying account/region before the first ingestion or query will succeed.

## Project Structure

```
bin/recipe-finder.ts          CDK app entry point (pinned to us-east-1)
lib/
  storage.ts                  S3 documents bucket + S3 Vector bucket/index
  knowledgebase.ts             Bedrock Knowledge Base + S3 data source + IAM role
  microservices.ts            The 3 Lambdas + S3 event notification wiring
  apigateway.ts                REST API (POST /recipes, POST /recipes/search)
  recipe-finder-stack.ts      Orchestrates the constructs above
src/recipe/
  createRecipe/               Writes recipe text to S3
  ingestRecipe/                Starts a Bedrock Knowledge Base ingestion job
  findRecipe/                  Queries the Knowledge Base via RetrieveAndGenerate
src/docs/                     Serves Swagger UI + the OpenAPI spec
test/recipe-finder.test.ts    CDK assertions smoke test
```

## Reference

Original article: https://medium.com/aws-in-plain-english/aws-use-case-s3-vector-buckets-the-game-changer-for-building-cost-effective-genai-applications-f2ac26ea3cc9
