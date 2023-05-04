import { assert } from "chai";

import { buildModule } from "../../src/new-api/build-module";
import { ModuleConstructor } from "../../src/new-api/internal/module-builder";

describe("contractFromArtifact", () => {
  const fakeArtifact: any = {};

  it("should be able to deploy with a contract based on an artifact", () => {
    const moduleWithContractFromArtifactDefinition = buildModule(
      "Module1",
      (m) => {
        const contract1 = m.contractFromArtifact("Contract1", fakeArtifact, [
          1,
          "a",
          BigInt("9007199254740991"),
        ]);

        return { contract1 };
      }
    );

    const constructor = new ModuleConstructor();
    const moduleWithContractFromArtifact = constructor.construct(
      moduleWithContractFromArtifactDefinition
    );

    assert.isDefined(moduleWithContractFromArtifact);

    // Sets ids based on module id and contract name
    assert.equal(moduleWithContractFromArtifact.id, "Module1");
    assert.equal(
      moduleWithContractFromArtifact.results.contract1.id,
      "Module1:Contract1"
    );

    // Stores the arguments
    assert.deepStrictEqual(
      moduleWithContractFromArtifact.results.contract1.constructorArgs,
      [1, "a", BigInt("9007199254740991")]
    );

    // 1 contract future
    assert.equal(moduleWithContractFromArtifact.futures.size, 1);

    // No submodules
    assert.equal(moduleWithContractFromArtifact.submodules.size, 0);
  });

  it("should be able to pass an arg dependency", () => {
    const moduleWithDependentContractsDefinition = buildModule(
      "Module1",
      (m) => {
        const example = m.contract("Example");
        const another = m.contractFromArtifact("Another", fakeArtifact, [
          example,
        ]);

        return { example, another };
      }
    );

    const constructor = new ModuleConstructor();
    const moduleWithDependentContracts = constructor.construct(
      moduleWithDependentContractsDefinition
    );

    assert.equal(moduleWithDependentContracts.futures.size, 2);

    const exampleFuture = moduleWithDependentContracts.results.example;
    const anotherFuture = moduleWithDependentContracts.results.another;

    assert.equal(anotherFuture.dependencies.size, 1);
    assert(anotherFuture.dependencies.has(exampleFuture!));
  });

  it("should be able to pass an after dependency", () => {
    const moduleWithDependentContractsDefinition = buildModule(
      "Module1",
      (m) => {
        const example = m.contract("Example");
        const another = m.contractFromArtifact("Another", fakeArtifact, [], {
          after: [example],
        });

        return { example, another };
      }
    );

    const constructor = new ModuleConstructor();
    const moduleWithDependentContracts = constructor.construct(
      moduleWithDependentContractsDefinition
    );

    assert.equal(moduleWithDependentContracts.futures.size, 2);

    const exampleFuture = moduleWithDependentContracts.results.example;
    const anotherFuture = moduleWithDependentContracts.results.another;

    assert.equal(anotherFuture.dependencies.size, 1);
    assert(anotherFuture.dependencies.has(exampleFuture!));
  });

  describe("passing id", () => {
    it("should use contract from artifact twice by passing an id", () => {
      const moduleWithSameContractTwiceDefinition = buildModule(
        "Module1",
        (m) => {
          const sameContract1 = m.contractFromArtifact(
            "SameContract",
            fakeArtifact,
            [],
            { id: "first" }
          );
          const sameContract2 = m.contractFromArtifact(
            "SameContract",
            fakeArtifact,
            [],
            {
              id: "second",
            }
          );

          return { sameContract1, sameContract2 };
        }
      );

      const constructor = new ModuleConstructor();
      const moduleWithSameContractTwice = constructor.construct(
        moduleWithSameContractTwiceDefinition
      );

      // Sets ids based on module id and contract name
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
      const moduleDefinition = buildModule("Module1", (m) => {
        const sameContract1 = m.contractFromArtifact(
          "SameContract",
          fakeArtifact
        );
        const sameContract2 = m.contractFromArtifact(
          "SameContract",
          fakeArtifact
        );

        return { sameContract1, sameContract2 };
      });
      const constructor = new ModuleConstructor();

      assert.throws(
        () => constructor.construct(moduleDefinition),
        /Contracts must have unique ids, Module1:SameContract has already been used/
      );
    });

    it("should throw if a contract tries to pass the same id twice", () => {
      const moduleDefinition = buildModule("Module1", (m) => {
        const sameContract1 = m.contractFromArtifact(
          "SameContract",
          fakeArtifact,
          [],
          {
            id: "same",
          }
        );
        const sameContract2 = m.contractFromArtifact(
          "SameContract",
          fakeArtifact,
          [],
          {
            id: "same",
          }
        );

        return { sameContract1, sameContract2 };
      });
      const constructor = new ModuleConstructor();

      assert.throws(
        () => constructor.construct(moduleDefinition),
        /Contracts must have unique ids, Module1:same has already been used/
      );
    });
  });
});