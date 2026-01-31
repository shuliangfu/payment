// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Context} from "./Context.sol";

abstract contract Ownable is Context {
  address public _owner;
  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

  constructor() {
    _owner = _msgSender();
    emit OwnershipTransferred(address(0), _owner);
  }

  modifier onlyOwner() {
    _onlyOwner();
    _;
  }

  /**
   * @dev Check if caller is contract owner
   */
  function _onlyOwner() internal view {
    require(_owner == _msgSender(), "Ownable: caller is not the owner");
  }

  /**
   * @dev Returns the address of the current owner
   * @return The owner address
   */
  function owner() public view returns (address) {
    return _owner;
  }

  function renounceOwnership() public onlyOwner {
    emit OwnershipTransferred(_owner, address(0));
    _owner = address(0);
  }

  function transferOwnership(address newOwner) public onlyOwner {
    require(newOwner != address(0), "Ownable: new owner is the zero address");
    _transferOwnership(newOwner);
  }

  function _transferOwnership(address newOwner) internal {
    address oldOwner = _owner;
    _owner = newOwner;
    emit OwnershipTransferred(oldOwner, newOwner);
  }

}
