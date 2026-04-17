FROM postgres:17-alpine

RUN apk add --no-cache bash tzdata

ENV TZ=America/Sao_Paulo

WORKDIR /app

COPY backup.sh /app/backup.sh
RUN chmod +x /app/backup.sh

CMD ["/app/backup.sh"]
