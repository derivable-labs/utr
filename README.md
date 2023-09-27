# Universal Token Router

The implementation of [EIP-6120](https://eips.ethereum.org/EIPS/eip-6120) for Derivable.

# Interfaces

```solidity
/// output for the UTR to verify the result of the transaction
struct Output {
  address recipient;
  uint256 eip; // token standard: 0 for ETH or EIP number
  address token; // token contract address
  uint256 id; // token id for EIP721 and EIP1155
  uint256 amountOutMin;
}

/// input for the UTR to prepare for the transaction
struct Input {
  uint256 mode;
  address recipient;
  uint256 eip; // token standard: 0 for ETH or EIP number
  address token; // token contract address
  uint256 id; // token id for EIP721 and EIP1155
  uint256 amountIn;
}

/// action to take in the UTR.exec transaction
struct Action {
  Input[] inputs;
  address code; // contract code address
  bytes data; // contract input data
}

/// @title The implemetation of the EIP-6120.
/// @author Derivable Labs
interface IUniversalTokenRouter {
    /// @dev accepting ETH for user execution (e.g. WETH.withdraw)
    receive() external payable {}

    /// The main entry point of the router
    /// @param outputs token behaviour for output verification
    /// @param actions router actions and inputs for execution
    function exec(
        Output[] memory outputs,
        Action[] memory actions
    ) external payable virtual override;
    
    /// Spend the pending payment. Intended to be called from the input.action.
    /// @param payment encoded payment data
    /// @param amount token amount to pay with payment
    function pay(bytes memory payment, uint256 amount) external virtual override;

    /// Discard a part of a pending payment. Can be called from the input.action
    /// to verify the payment without transfering any token.
    /// @param payment encoded payment data
    /// @param amount token amount to pay with payment
    function discard(bytes memory payment, uint256 amount) public virtual override;
}
```

# Solidity Style Guide

The Solidity code follows the official [Solidity style guide](https://docs.soliditylang.org/en/latest/style-guide.html), except for the following conventions.

For the storage variables, we opt to use our own style to have a clear view of storage access, making the code much more readable and preventing almost all local variable name collisions. A similar naming style is partly used by Chainlink and documented [here](https://github.com/smartcontractkit/chainlink/blob/master/contracts/STYLE.md#naming-and-casing).

* Storage variables are prefixed with `s_` to indicate that they reside in storage and are expensive to read and write: `s_storageVariable`.
* Transient storage variables are prefixed with `t_` to indicate that they must be reset before the transaction ends: `t_transientStorageVariable`.
