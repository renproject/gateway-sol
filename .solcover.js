module.exports = {
    copyPackages: ["@openzeppelin/contracts-ethereum-package"], // needed to import from node_modules.
    testrpcOptions: "-d --accounts 10 --port 8555",
    skipFiles: [
        // REN token.
        "RenToken/RenToken.sol",

        // Contract for building bindings.
        "test/Bindings.sol",

        // Migration contract.
        "migrations/Migrations.sol",

        // Examples
        "Gateway/adapters/BasicAdapter.sol",
        "Gateway/examples/Vesting.sol",

        // Contracts for assisting the tests.
        "test/LinkedListTest.sol",
        "test/StringTest.sol",
        "test/CompareTest.sol",
        "test/tokens/PaymentToken.sol",
    ],
};
