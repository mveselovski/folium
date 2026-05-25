FROM node:20-alpine

WORKDIR /app

RUN npm install express marked mammoth xlsx

COPY folium.js .

EXPOSE 3000

CMD ["node", "folium.js"]
