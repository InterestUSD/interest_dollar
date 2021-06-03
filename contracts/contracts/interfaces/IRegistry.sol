pragma solidity 0.5.11;

interface IRegistry {
    function getAddressForOrDie(bytes32) external view returns (address);
}
