const path=require('path');
const HtmlWebpackPlugin=require('html-webpack-plugin');
module.exports=(_,argv)=>({
 mode:argv.mode||'development',
 entry:{main:'./src/main.js',map:'./src/map-main.js'},
 output:{path:path.resolve(__dirname,'dist'),filename:'assets/[name].[contenthash].js',clean:true,publicPath:'./'},
 devtool:false,
 module:{rules:[{test:/\.css$/,use:['style-loader','css-loader']}]},
 plugins:[
  new HtmlWebpackPlugin({template:'./public/index.html',filename:'index.html',chunks:['main']}),
  new HtmlWebpackPlugin({template:'./public/map.html',filename:'map.html',chunks:['map']})
 ],
 devServer:{port:8080,host:'0.0.0.0',historyApiFallback:true}
});