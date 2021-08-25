pragma solidity 0.5.11;

import "./MintableERC20.sol";
import { IVault } from "../interfaces/IVault.sol";

contract MockEvilCUSD is MintableERC20 {
    uint256 public constant decimals = 18;
    string public constant symbol = "cUSD";
    string public constant name = "cUSD";
    address host;
    address realCoin;

    constructor(address _host, address _realCoin) public {
        host = _host;
        realCoin = _realCoin;
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _amount
    ) public returns (bool) {
        // call mint again!
        if (_amount != 69) {
            IVault(host).mint(address(this), 69, 0);
        }
        return true;
    }
}
