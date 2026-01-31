// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IBEP20} from "./IBEP20.sol";

/**
 * @title SafeERC20
 * @dev Utility library for safely handling ERC20/BEP20 token transfers
 * Checks return values of transfer and transferFrom to ensure transfer success
 */
library SafeERC20 {
  /**
   * @dev Safely execute transfer operation
   * @param token Token contract address
   * @param to Receiver address
   * @param amount Transfer amount
   */
  function safeTransfer(IBEP20 token, address to, uint256 amount) internal {
    require(token.transfer(to, amount), "SafeERC20: transfer failed");
  }

  /**
   * @dev Safely execute transferFrom operation
   * @param token Token contract address
   * @param from Sender address
   * @param to Receiver address
   * @param amount Transfer amount
   */
  function safeTransferFrom(IBEP20 token, address from, address to, uint256 amount) internal {
    require(token.transferFrom(from, to, amount), "SafeERC20: transferFrom failed");
  }
}
