FROM oven/bun:latest

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY ./ /usr/src/app
RUN bun install --production
ENV NODE_ENV production
ENV PORT 80


EXPOSE 80

CMD [ "bun", "start" ]