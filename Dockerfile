FROM node:21.6.1-alpine as buildenv

COPY src/ /build/src/
COPY b2mpatch.js diff2patch.js package.json package-lock.json /build/

WORKDIR /build

RUN npm install

FROM node:21.6.1-alpine

USER node

WORKDIR /home/node

COPY --from=buildenv --chown=node:node /build/ .

ENTRYPOINT ["node"]