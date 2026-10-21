# 第三方软件说明

本项目自有源码采用根目录的 [MIT 许可证](LICENSE)。第三方组件继续遵守各自许可证，本项目许可证不取代其许可或赋予 WPS 商标权利。

- WPS Office 是运行插件所需的独立软件，由用户从 WPS 官方渠道安装，不包含在发行包内。
- Windows 一键安装器内置 Node.js 22.23.3，保留官方发行包的 LICENSE（包括第三方组件声明）。上游：[Node.js](https://github.com/nodejs/node/blob/v22.23.3/LICENSE)。
- Windows 一键安装器内置 PowerShell 7.6.7，保留官方发行包的许可证与第三方声明。上游：[PowerShell](https://github.com/PowerShell/PowerShell/tree/v7.6.7)。
- 官方下载地址及 SHA-256 锁定在 [runtime-lock.json](wps-addin/install/desktop/runtime-lock.json)。重新打包分发时须保留运行环境附带的许可与声明。

项目运行数据、用户导入清单、报价、分类学习记录、联系方式及用户模板不属于开源交付内容。
