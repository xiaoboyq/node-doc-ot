FROM harbor.weizhipin.com/tcloud/node:14.19

ENV TZ=Asia/Shanghai

RUN mkdir -p /data/logs

WORKDIR /opt/app/

COPY . ./zhishu-node-ot

WORKDIR zhishu-node-ot

RUN ["yarn", "--production", "--registry", "https://npm.weizhipin.com"]

ENTRYPOINT ["yarn", "egg-scripts", "start", "--port=7010", "--title=egg-server-node-ot"]

EXPOSE 7010

HEALTHCHECK --interval=10s --timeout=3s \
  CMD curl -fs http://localhost:7010 || exit 1