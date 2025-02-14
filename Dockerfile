FROM oven/bun:1 AS base
WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y python3 python3-pip
RUN pip3 install sherlock-project

FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/ ./

USER bun
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE ${PORT}/tcp
ENTRYPOINT [ "bun", "--bun", "run", "app/server.tsx" ]
