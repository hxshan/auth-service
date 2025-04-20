FROM node:18

WORKDIR /app

COPY package*.json  /app/

RUN npm install

COPY .  /app/

EXPOSE 3002
    
CMD ["npm", "start"]