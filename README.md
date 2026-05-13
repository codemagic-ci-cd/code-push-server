# CodePush Server

CodePush Server is an over-the-air update service for React Native applications. Developers can use it to publish app updates such as JavaScript, HTML, CSS, and image changes to a self-hosted server, while mobile apps use the [CodePush React Native Client SDK](https://github.com/codemagic-ci-cd/react-native-code-push) to query and install updates.

CodePush was originally created by Microsoft and open-sourced under the MIT License. This server is now maintained by Codemagic at [codemagic-ci-cd/code-push-server](https://github.com/codemagic-ci-cd/code-push-server), alongside the compatible [codemagic-ci-cd/react-native-code-push](https://github.com/codemagic-ci-cd/react-native-code-push) SDK.


## Getting Started

### CodePush Server

The CodePush server, located in the `api` subdirectory, allows developers to build, deploy and manage CodePush updates themselves.
For detailed information about the CodePush server, including installation instructions and usage details, please refer to the [CodePush Server README](./api/README.md).


### CodePush CLI

The CodePush CLI, located in `cli` subdirectory, is a command-line tool that allows developers to interact with the CodePush server. For detailed information about the CodePush CLI, including installation instructions and usage details, please refer to the [CodePush CLI README](./cli/README.md).


## Contributing

Contributions are welcome. Please use [GitHub Issues](https://github.com/codemagic-ci-cd/code-push-server/issues) to report bugs, request features, or discuss changes before opening larger pull requests.


## Support

For support, usage questions, and community discussion, please open a [GitHub Issue](https://github.com/codemagic-ci-cd/code-push-server/issues).
