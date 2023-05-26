import { assert } from "chai";

import { defineModule } from "../../src/new-api/define-module";
import {
  AccountRuntimeValueImplementation,
  NamedContractDeploymentFutureImplementation,
} from "../../src/new-api/internal/module";
import { ModuleConstructor } from "../../src/new-api/internal/module-builder";
import { FutureType, RuntimeValueType } from "../../src/new-api/types/module";
import { assertInstanceOf } from "./helpers";

describe("contract", () => {
  it("should be able to setup a deploy contract call", () => {
    const moduleWithASingleContractDefinition = defineModule("Module1", (m) => {
      const contract1 = m.contract("Contract1");

      return { contract1 };
    });

    const constructor = new ModuleConstructor();
    const moduleWithASingleContract = constructor.construct(
      moduleWithASingleContractDefinition
    );

    assert.isDefined(moduleWithASingleContract);

    // Sets ids based on module id and contract name
    assert.equal(moduleWithASingleContract.id, "Module1");
    assert.equal(
      moduleWithASingleContract.results.contract1.id,
      "Module1:Contract1"
    );

    // 1 contract future
    assert.equal(moduleWithASingleContract.futures.size, 1);
    assert.equal(
      [...moduleWithASingleContract.futures][0].type,
      FutureType.NAMED_CONTRACT_DEPLOYMENT
    );

    // No submodules
    assert.equal(moduleWithASingleContract.submodules.size, 0);
  });

  it("should be able to pass one contract as an arg dependency to another", () => {
    const moduleWithDependentContractsDefinition = defineModule(
      "Module1",
      (m) => {
        const example = m.contract("Example");
        const another = m.contract("Another", [example]);

        return { example, another };
      }
    );

    const constructor = new ModuleConstructor();
    const moduleWithDependentContracts = constructor.construct(
      moduleWithDependentContractsDefinition
    );

    assert.isDefined(moduleWithDependentContracts);

    const exampleFuture = [...moduleWithDependentContracts.futures].find(
      ({ id }) => id === "Module1:Example"
    );

    const anotherFuture = [...moduleWithDependentContracts.futures].find(
      ({ id }) => id === "Module1:Another"
    );

    if (
      !(anotherFuture instanceof NamedContractDeploymentFutureImplementation)
    ) {
      assert.fail("Not a named contract deployment");
    }

    assert.equal(anotherFuture.dependencies.size, 1);
    assert(anotherFuture.dependencies.has(exampleFuture!));
  });

  it("should be able to pass one contract as an after dependency of another", () => {
    const moduleWithDependentContractsDefinition = defineModule(
      "Module1",
      (m) => {
        const example = m.contract("Example");
        const another = m.contract("Another", [], { after: [example] });

        return { example, another };
      }
    );

    const constructor = new ModuleConstructor();
    const moduleWithDependentContracts = constructor.construct(
      moduleWithDependentContractsDefinition
    );

    assert.isDefined(moduleWithDependentContracts);

    const exampleFuture = [...moduleWithDependentContracts.futures].find(
      ({ id }) => id === "Module1:Example"
    );

    const anotherFuture = [...moduleWithDependentContracts.futures].find(
      ({ id }) => id === "Module1:Another"
    );

    if (
      !(anotherFuture instanceof NamedContractDeploymentFutureImplementation)
    ) {
      assert.fail("Not a named contract deployment");
    }

    assert.equal(anotherFuture.dependencies.size, 1);
    assert(anotherFuture.dependencies.has(exampleFuture!));
  });

  it("should be able to pass a library as a dependency of a contract", () => {
    const moduleWithDependentContractsDefinition = defineModule(
      "Module1",
      (m) => {
        const example = m.library("Example");
        const another = m.contract("Another", [], {
          libraries: { Example: example },
        });

        return { example, another };
      }
    );

    const constructor = new ModuleConstructor();
    const moduleWithDependentContracts = constructor.construct(
      moduleWithDependentContractsDefinition
    );

    assert.isDefined(moduleWithDependentContracts);

    const exampleFuture = [...moduleWithDependentContracts.futures].find(
      ({ id }) => id === "Module1:Example"
    );

    const anotherFuture = [...moduleWithDependentContracts.futures].find(
      ({ id }) => id === "Module1:Another"
    );

    if (
      !(anotherFuture instanceof NamedContractDeploymentFutureImplementation)
    ) {
      assert.fail("Not a named contract deployment");
    }

    assert.equal(anotherFuture.dependencies.size, 1);
    assert.equal(anotherFuture.libraries.Example.id, exampleFuture?.id);
    assert(anotherFuture.dependencies.has(exampleFuture!));
  });

  it("should be able to pass value as an option", () => {
    const moduleWithDependentContractsDefinition = defineModule(
      "Module1",
      (m) => {
        const another = m.contract("Another", [], { value: BigInt(42) });

        return { another };
      }
    );

    const constructor = new ModuleConstructor();
    const moduleWithDependentContracts = constructor.construct(
      moduleWithDependentContractsDefinition
    );

    assert.isDefined(moduleWithDependentContracts);

    const anotherFuture = [...moduleWithDependentContracts.futures].find(
      ({ id }) => id === "Module1:Another"
    );

    if (
      !(anotherFuture instanceof NamedContractDeploymentFutureImplementation)
    ) {
      assert.fail("Not a named contract deployment");
    }

    assert.equal(anotherFuture.value, BigInt(42));
  });

  it("should be able to pass a string as from option", () => {
    const moduleWithDependentContractsDefinition = defineModule(
      "Module1",
      (m) => {
        const another = m.contract("Another", [], { from: "0x2" });

        return { another };
      }
    );

    const constructor = new ModuleConstructor();
    const moduleWithDependentContracts = constructor.construct(
      moduleWithDependentContractsDefinition
    );

    assert.isDefined(moduleWithDependentContracts);

    const anotherFuture = [...moduleWithDependentContracts.futures].find(
      ({ id }) => id === "Module1:Another"
    );

    if (
      !(anotherFuture instanceof NamedContractDeploymentFutureImplementation)
    ) {
      assert.fail("Not a named contract deployment");
    }

    assert.equal(anotherFuture.from, "0x2");
  });

  it("Should be able to pass an AccountRuntimeValue as from option", () => {
    const moduleWithDependentContractsDefinition = defineModule(
      "Module1",
      (m) => {
        const another = m.contract("Another", [], { from: m.getAccount(1) });

        return { another };
      }
    );

    const constructor = new ModuleConstructor();
    const moduleWithDependentContracts = constructor.construct(
      moduleWithDependentContractsDefinition
    );

    assert.isDefined(moduleWithDependentContracts);

    const anotherFuture = [...moduleWithDependentContracts.futures].find(
      ({ id }) => id === "Module1:Another"
    );

    if (
      !(anotherFuture instanceof NamedContractDeploymentFutureImplementation)
    ) {
      assert.fail("Not a named contract deployment");
    }

    assertInstanceOf(anotherFuture.from, AccountRuntimeValueImplementation);
    assert.equal(anotherFuture.from.accountIndex, 1);
  });

  describe("passing id", () => {
    it("should be able to deploy the same contract twice by passing an id", () => {
      const moduleWithSameContractTwiceDefinition = defineModule(
        "Module1",
        (m) => {
          const sameContract1 = m.contract("SameContract", [], { id: "first" });
          const sameContract2 = m.contract("SameContract", [], {
            id: "second",
          });

          return { sameContract1, sameContract2 };
        }
      );

      const constructor = new ModuleConstructor();
      const moduleWithSameContractTwice = constructor.construct(
        moduleWithSameContractTwiceDefinition
      );

      assert.equal(moduleWithSameContractTwice.id, "Module1");
      assert.equal(
        moduleWithSameContractTwice.results.sameContract1.id,
        "Module1:first"
      );
      assert.equal(
        moduleWithSameContractTwice.results.sameContract2.id,
        "Module1:second"
      );
    });

    it("should throw if the same contract is deployed twice without differentiating ids", () => {
      const moduleDefinition = defineModule("Module1", (m) => {
        const sameContract1 = m.contract("SameContract");
        const sameContract2 = m.contract("SameContract");

        return { sameContract1, sameContract2 };
      });

      const constructor = new ModuleConstructor();

      assert.throws(
        () => constructor.construct(moduleDefinition),
        /Duplicated id Module1:SameContract found in module Module1/
      );
    });

    it("should throw if a contract tries to pass the same id twice", () => {
      const moduleDefinition = defineModule("Module1", (m) => {
        const sameContract1 = m.contract("SameContract", [], {
          id: "same",
        });
        const sameContract2 = m.contract("SameContract", [], {
          id: "same",
        });

        return { sameContract1, sameContract2 };
      });

      const constructor = new ModuleConstructor();

      assert.throws(
        () => constructor.construct(moduleDefinition),
        /Duplicated id Module1:same found in module Module1/
      );
    });
  });
});
