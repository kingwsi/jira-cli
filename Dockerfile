FROM node:22-alpine AS web-builder

WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM golang:1.25-alpine AS go-builder

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=web-builder /src/internal/web/dist ./internal/web/dist
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/jira ./main.go

FROM alpine:3.22

RUN apk add --no-cache ca-certificates \
    && addgroup -S jira \
    && adduser -S -G jira -h /data jira

COPY --from=go-builder /out/jira /usr/local/bin/jira

USER jira
WORKDIR /data
EXPOSE 8080

ENTRYPOINT ["jira"]
CMD ["--host", "0.0.0.0", "--port", "8080"]
