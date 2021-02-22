FROM node:14.15-alpine

# Set the working directory.
WORKDIR /app

# Copying the code into image. Be aware no config files are including.
ADD ./client ./client
ADD ./server ./server
ADD ./templates ./templates
ADD package.json .
ADD package-lock.json .

RUN npm install --production

RUN mkdir certs
RUN wget https://s3.amazonaws.com/rds-downloads/rds-combined-ca-bundle.pem -P ./certs/

# Exposing our endpoint to Docker.
EXPOSE  8000

# When starting a container with our image, this command will be run.
CMD ["node", "server/index.js"]
