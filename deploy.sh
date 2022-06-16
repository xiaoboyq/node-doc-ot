# 启动脚本，跟随项目一起打包
egg-scripts stop --title=egg-server-node-ot
rm -rf node_modules
yarn install --production
echo '安装依赖完毕，开始启动'
egg-scripts start --port=7010 --daemon --title=egg-server-node-ot