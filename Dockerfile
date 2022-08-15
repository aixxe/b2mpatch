FROM node:18.7.0-alpine as buildenv

COPY src/ /build/src/
COPY b2mpatch.js diff2patch.js package.json package-lock.json /build/

WORKDIR /build

RUN apk add --no-cache python3 make g++ \
 && npm install

FROM node:18.7.0-alpine

RUN apk add --no-cache pev

USER node

WORKDIR /home/node

COPY --from=buildenv --chown=node:node /build/ .

ENTRYPOINT ["node"]