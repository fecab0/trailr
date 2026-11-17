# External tools and credentials

Read this reference before using a remote generation service or adding a tool that needs an account or credentials. The same rules apply to speech, image/video generation, stock media and other optional services.

## Selection and authorization

Use an appropriate existing connected tool when its capabilities satisfy the brief; keep credentials managed by that connector. ElevenLabs speech uses the official ElevenLabs MCP with OAuth; do not replace it with a direct API script or ask for an ElevenLabs API key. For other services, use an approved local tool, an official API where available, or the website's normal download flow. Do not require a particular marketplace just to use Trailr.

Before sending a new generation request, establish the provider, the content being sent, the expected output and the applicable cost or credit limit. Reuse authorization already given for that provider and scope. Preparing scripts, checking local dependencies and producing offline plans do not require another approval. Enabling an optional integration is not permission to create accounts, buy credits or generate paid media.

If current cost is unavailable, say so and have the user establish a limit before billable calls. Do not fabricate a price from character count or a remembered rate. Preview samples also count toward usage. Do not automatically install integrations or subscribe the user to services.

## Credentials

- Prefer the connector's own authentication when using a connected tool.
- ElevenLabs authentication stays in the official MCP connection. For other services using direct APIs, use the provider's documented environment variable or a secret manager.
- Never put credentials in command arguments, chat, `script.json`, source bundles, HTML, logs or version control. Do not print environment variables or search unrelated credential files.
- Use placeholders in documentation. A user's key belongs to their environment, not the skill package.
- Send only the approved input needed by the selected service. Do not upload the entire project to generate one spoken line.

## Failures and repeat calls

Cache usable results and regenerate only changed inputs. Respect provider errors and usage limits. A timeout can occur after a billable job has started; check the existing job or provider history before retrying. Never silently switch to another provider, model or account, and never loop on paid calls until something succeeds.

If the approved service is unavailable, keep independent local work moving and present the concrete alternatives: restore the connection, supply the asset, use a suitable local tool, or approve a different provider. Preserve the user's decision on whether the final video needs that asset.
