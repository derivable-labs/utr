# Universal Token Router

The implementation of [EIP-6120](https://eips.ethereum.org/EIPS/eip-6120) for Derivable.

# Solidity Style Guide

The Solidity code follows the official [Solidity style guide](https://docs.soliditylang.org/en/latest/style-guide.html), except for the following conventions.

For the storage variables, we opt to use our own style to have a clear view of storage access, making the code much more readable and preventing almost all local variable name collisions. A similar naming style is partly used by Chainlink and documented [here](https://github.com/smartcontractkit/chainlink/blob/master/contracts/STYLE.md#naming-and-casing).

* Storage variables are prefixed with `s_` to indicate that they reside in storage and are expensive to read and write: `s_storageVariable`.
* Transient storage variables are prefixed with `t_` to indicate that they must be reset before the transaction ends: `t_transientStorageVariable`.
