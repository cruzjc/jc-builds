# JC-Builds Public Lab

JC-Builds is a static Astro site that acts as:

- a human-friendly public homepage for active projects
- an agent-readable registry with stable routes and dated update history
- a central source for tracking project changes through normal git-authored content

The public site is designed so a Codex-created app or project can later be registered here by updating the repo with a project record and dated updates.

## Public Routes

- `/`
- `/about/`
- `/projects/{slug}/`
- `/projects/template/`
- `/projects/index.json`
- `/updates/index.json`
- `/llms.txt`
- `/rss.xml`
- `/robots.txt`
- `/sitemap-index.xml`

The `/about/` page explains the site objective and update workflow. The `/projects/template/` page is the canonical public reference entry for agents creating a new project record.

## Stack

- Astro 6
- TypeScript
- MDX content collections
- Static JSON, RSS, `llms.txt`, `robots.txt`, and sitemap surfaces
- S3 + CloudFront deployment through GitHub Actions

## Local Setup

Use Node 22 and pnpm 10.

```bash
pnpm install
pnpm dev
```

The `dev` and `build` scripts run `pnpm sync:projects` first. That script reads `project-sync.config.json` and enriches project metadata from local git repositories when they exist.

## Content Scaffolding

For routine content work, scaffold the file first and then edit the generated MDX instead of hand-creating frontmatter from scratch.

Create a project record:

```bash
pnpm new:project -- \
  --title "My Project" \
  --summary "Short public summary" \
  --tags astro,automation \
  --repo-url https://github.com/example/my-project
```

Create a dated update or post:

```bash
pnpm new:update -- \
  --project my-project \
  --title "Shipped the first public release" \
  --summary "Published the initial project record and documented the operating model."
```

`pnpm new:post` is an alias for `pnpm new:update`.

The scaffold commands:

- write the MDX file into the correct content collection
- apply the expected frontmatter shape
- infer sane defaults like `slug`, `heroImage`, `order`, and today's date
- auto-link update entries back to the project page when the project already exists
- optionally register a local repo in `project-sync.config.json` during project creation

## Content Model

Project records live in [`src/content/projects`](/mnt/e/Projects/JC-Builds/src/content/projects).

Update log entries live in [`src/content/updates`](/mnt/e/Projects/JC-Builds/src/content/updates).

Each project keeps stable frontmatter:

- `slug`
- `title`
- `summary`
- `agentSummary`
- `status`
- `surface`
- `featured`
- `tags`
- `repoUrls`
- `demoUrl`
- `heroImage`
- `lastUpdated`
- `order`
- `labStage`

`surface` controls how the entry is exposed:

- `listed` means the project appears on the homepage, in `/projects/index.json`, and in listed-project update feeds
- `reference` means the page is publicly routable, but excluded from the main portfolio and feed surfaces

Each update keeps dated frontmatter:

- `projectSlug`
- `date`
- `title`
- `summary`
- `links`
- `source`

## Agent Workflow

For routine updates, an agent should:

1. use `pnpm new:project` for a new project record or `pnpm new:update` for a dated post
2. review the generated MDX and replace the scaffold body with real project details
3. use `surface: listed` for a real public project or `surface: reference` for a reusable pattern
4. optionally register a local repo in `project-sync.config.json`
5. run `pnpm build` to validate the content layer and output surfaces
6. push the branch and let GitHub Actions deploy production changes after merge to `main`

The public template entry at [`src/content/projects/template.mdx`](/mnt/e/Projects/JC-Builds/src/content/projects/template.mdx) should be used as the starting shape for new project records.

## Machine-Readable Surfaces

- `/llms.txt` for the shortest route map
- `/projects/index.json` for listed project records
- `/updates/index.json` for listed-project update history
- `/rss.xml` for listed-project update subscriptions
- `/robots.txt` and `/sitemap-index.xml` for crawl discovery

## Deployment

The GitHub Actions workflow expects:

- `SITE_URL`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `AWS_CLOUDFRONT_DISTRIBUTION_ID`
- `AWS_DEPLOY_ROLE_ARN`

The deployment flow is:

1. install pnpm and Node 22
2. run `pnpm build`
3. sync `dist/` to S3
4. invalidate CloudFront

Routine content changes should go through git plus GitHub Actions, not a manual local AWS deploy. Local AWS CLI publishing is only the fallback path.

Record actual AWS resources in [`AWS-Infrastructure.csv`](/mnt/e/Projects/JC-Builds/AWS-Infrastructure.csv) as they are created.
