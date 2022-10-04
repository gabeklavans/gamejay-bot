FROM node:lts-alpine

RUN apk update && apk upgrade && \
    apk add --no-cache git
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY ./ /usr/src/app
RUN npm install --production=false 
RUN npm run build
# only keep what's needed for prod
RUN rm -rf node_modules && npm install --production && npm cache clean --force
ENV NODE_ENV production
ENV PORT 80


EXPOSE 80

CMD [ "npm", "start" ]