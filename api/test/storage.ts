// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as shortid from "shortid";

import { AzureStorage } from "../script/storage/azure-storage";
import * as storageTypes from "../script/storage/storage";
import * as utils from "./utils";
import { hashWithSHA256 } from "../script/utils/common";


describe("Azure Storage", () => storageTests(AzureStorage));

function storageTests(StorageType: new (...args: any[]) => storageTypes.Storage, disablePersistence?: boolean) {
  let storage: storageTypes.Storage;

  before(() => {
    if (StorageType === AzureStorage) {
      storage = new StorageType(disablePersistence);
    }
  });

  describe("Storage management", () => {
    it("should be healthy if and only if running Azure storage", () => {
      return storage.checkHealth().then(
        /*returnedHealthy*/() => {
          assert.equal(StorageType, AzureStorage, "Should only return healthy if running Azure storage");
        },
      );
    });

    if (StorageType === AzureStorage) {
      it("should allow reconfiguring of Azure storage credentials", () => {
        const azureStorage: AzureStorage = <AzureStorage>storage;
        return azureStorage
          .reinitialize("wrongaccount", "wrongkey")
          .then(
            failOnCallSucceeded,
            /*returnedUnhealthy*/() => {
              if (!process.env.EMULATED && process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_ACCESS_KEY) {
                return azureStorage.reinitialize(process.env.AZURE_STORAGE_ACCOUNT, process.env.AZURE_STORAGE_ACCESS_KEY);
              } else {
                return azureStorage.reinitialize();
              }
            }
          )
          .then(() => {
            return storage.checkHealth(); // Fails test if unhealthy
          });
      });
    }
  });

  describe("Access Key", () => {
    let account: storageTypes.Account;

    beforeEach(() => {
      account = utils.makeAccount();
      return storage.addAccount(account).then((accountId: string): void => {
        account.id = accountId;
      });
    });

    it("can generate an id for an access key", () => {
      const accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();

      return storage.addAccessKey(account.id, accessKey).then((accessKeyId: string): void => {
        assert(accessKeyId);
      });
    });

    it("can retrieve an access key by id", () => {
      const accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();

      return storage
        .addAccessKey(account.id, accessKey)
        .then((accessKeyId: string): Promise<storageTypes.AccessKey> => {
          return storage.getAccessKey(account.id, accessKeyId);
        })
        .then((retrievedAccessKey: storageTypes.AccessKey): void => {
          if (StorageType === AzureStorage) {
            assert.equal(retrievedAccessKey.name, hashWithSHA256(accessKey.name));
          } else {
            assert.equal(retrievedAccessKey.name, accessKey.name);
          }
          assert.equal(retrievedAccessKey.friendlyName, accessKey.friendlyName);
        });
    });

    it("can retrieve the account id by the access key name", () => {
      const accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();

      return storage
        .addAccessKey(account.id, accessKey)
        .then((accessKeyId: string): Promise<string> => {
          return storage.getAccountIdFromAccessKey(accessKey.name);
        })
        .then((retrievedAccountId: string): void => {
          assert.equal(retrievedAccountId, account.id);
        });
    });

    it("rejects promise for an invalid id", () => {
      const accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();

      return storage
        .addAccessKey(account.id, accessKey)
        .then((accessKeyId: string): Promise<storageTypes.AccessKey> => {
          return storage.getAccessKey(account.id, "invalid");
        })
        .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
        });
    });

    it("can retrieve access keys for account", () => {
      const accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();

      return storage
        .addAccessKey(account.id, accessKey)
        .then((accessKeyId: string): Promise<storageTypes.AccessKey[]> => {
          return storage.getAccessKeys(account.id);
        })
        .then((accessKeys: storageTypes.AccessKey[]): void => {
          assert.equal(1, accessKeys.length);
          if (StorageType === AzureStorage) {
            assert.equal(accessKeys[0].name, hashWithSHA256(accessKey.name));
          } else {
            assert.equal(accessKeys[0].name, accessKey.name);
          }
          assert.equal(accessKeys[0].friendlyName, accessKey.friendlyName);
        });
    });

    it("can remove an access key", () => {
      const accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();

      return storage
        .addAccessKey(account.id, accessKey)
        .then((accessKeyId: string): Promise<void> => {
          return storage.removeAccessKey(account.id, accessKeyId);
        })
        .then((): Promise<storageTypes.AccessKey> => {
          return storage.getAccessKey(account.id, accessKey.id);
        })
        .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
        });
    });

    it("can update an access key", () => {
      const accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();

      return storage
        .addAccessKey(account.id, accessKey)
        .then((addedAccessKeyId: string): Promise<void> => {
          accessKey.id = addedAccessKeyId;
          accessKey.friendlyName = "updated description";
          if (StorageType === AzureStorage) {
            accessKey.name = hashWithSHA256(accessKey.name);
          }
          return storage.updateAccessKey(account.id, accessKey);
        })
        .then((): Promise<storageTypes.AccessKey> => {
          return storage.getAccessKey(account.id, accessKey.id);
        })
        .then((retrievedAccessKey: storageTypes.AccessKey): void => {
          assert.equal(retrievedAccessKey.friendlyName, "updated description");
        });
    });

    it("addAccessKey(...) will not modify the accessKey argument", () => {
      const accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();
      const expectedResult: string = JSON.stringify(accessKey);

      return storage.addAccessKey(account.id, accessKey).then((accessKeyId: string): void => {
        const actualResult: string = JSON.stringify(accessKey);

        assert.strictEqual(actualResult, expectedResult);
      });
    });

    it("updateAccessKey(...) will not modify the accessKey argument", () => {
      const accessKey: storageTypes.AccessKey = utils.makeStorageAccessKey();
      let expectedResult: string;

      return storage
        .addAccessKey(account.id, accessKey)
        .then((addedAccessKeyId: string): Promise<void> => {
          accessKey.id = addedAccessKeyId;
          accessKey.friendlyName = "updated description";
          if (StorageType === AzureStorage) {
            accessKey.name = hashWithSHA256(accessKey.name);
          }

          expectedResult = JSON.stringify(accessKey);

          return storage.updateAccessKey(account.id, accessKey);
        })
        .then((): void => {
          const actualResult: string = JSON.stringify(accessKey);

          assert.equal(actualResult, expectedResult);
        });
    });
  });

  describe("Account", () => {
    it("will reject promise for a non-existent account by accountId", () => {
      return storage.getAccount("IdThatDoesNotExist").then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
        assert.equal(error.code, storageTypes.ErrorCode.NotFound);
      });
    });

    it("can generate an id for a new account", () => {
      const account: storageTypes.Account = utils.makeAccount();

      return storage.addAccount(account).then((accountId: string) => {
        assert(accountId);
      });
    });

    it("can get an account by accountId", () => {
      const account: storageTypes.Account = utils.makeAccount();
      account.name = "test 456";

      return storage
        .addAccount(account)
        .then((accountId: string) => {
          return storage.getAccount(accountId);
        })
        .then((accountFromApi: storageTypes.Account) => {
          assert.equal(accountFromApi.name, "test 456");
        });
    });

    it("can get an account by email", () => {
      const account: storageTypes.Account = utils.makeAccount();
      account.name = "test 789";

      return storage
        .addAccount(account)
        .then((accountId: string) => {
          return storage.getAccountByEmail(account.email);
        })
        .then((accountFromApi: storageTypes.Account) => {
          assert.equal(accountFromApi.name, account.name);
        });
    });

    it("can update an account's provider details", () => {
      const account: storageTypes.Account = utils.makeAccount();

      return storage
        .addAccount(account)
        .then((accountId: string) => {
          account.id = accountId;
          const updates: any = { gitHubId: "2" };
          return storage.updateAccount(account.email, updates);
        })
        .then(() => {
          return storage.getAccount(account.id);
        })
        .then((updatedAccount: storageTypes.Account) => {
          assert.equal(updatedAccount.name, account.name);
          assert.equal(updatedAccount.email, account.email);
          assert.equal(updatedAccount.gitHubId, "2");
          assert(typeof updatedAccount.azureAdId === "undefined");
          assert(typeof updatedAccount.microsoftId === "undefined");
        });
    });

    it("will reject promise for a non-existent email", () => {
      return storage.getAccountByEmail("non-existent-emaiL@test.com").then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
        assert.equal(error.code, storageTypes.ErrorCode.NotFound);
      });
    });

    it("addAccount(...) will not modify the account argument", () => {
      const account: storageTypes.Account = utils.makeAccount();
      const expectedResult: string = JSON.stringify(account);

      return storage.addAccount(account).then((accountId: string) => {
        const actualResult: string = JSON.stringify(account);

        assert.strictEqual(actualResult, expectedResult);
      });
    });

    it("addAccount(...) will not accept duplicate emails even if cased differently", () => {
      const account: storageTypes.Account = utils.makeAccount();
      const expectedResult: string = JSON.stringify(account);

      return storage
        .addAccount(account)
        .then((accountId: string) => {
          const newAccount: storageTypes.Account = utils.makeAccount();
          newAccount.email = account.email.toUpperCase();
          return storage.addAccount(newAccount);
        })
        .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.AlreadyExists);
        });
    });
  });

  describe("App", () => {
    let account: storageTypes.Account;
    const collaboratorNotFoundMessage: string = "The specified e-mail address doesn't represent a registered user";

    beforeEach(() => {
      account = utils.makeAccount();

      return storage.addAccount(account).then((accountId: string) => {
        account.id = accountId;
      });
    });

    it("can generate an id for an app", () => {
      const app: storageTypes.App = utils.makeStorageApp();

      return storage.addApp(account.id, app).then((addedApp: storageTypes.App) => {
        assert(addedApp.id);
      });
    });

    it("rejects promise when adding to a non-existent account", () => {
      const app: storageTypes.App = utils.makeStorageApp();

      return storage.addApp("non-existent", app).then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
        assert.equal(error.code, storageTypes.ErrorCode.NotFound);
      });
    });

    it("can retrieve an app by id", () => {
      const app: storageTypes.App = utils.makeStorageApp();
      app.name = "my app";

      return storage
        .addApp(account.id, app)
        .then((addedApp: storageTypes.App) => {
          return storage.getApp(account.id, addedApp.id);
        })
        .then((retrievedApp: storageTypes.App) => {
          assert.equal(retrievedApp.name, "my app");
        });
    });

    it("rejects promise for an invalid id", () => {
      const app: storageTypes.App = utils.makeStorageApp();
      app.name = "my app";

      return storage
        .addApp(account.id, app)
        .then((addedApp: storageTypes.App) => {
          return storage.getApp(addedApp.id, "invalid");
        })
        .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
        });
    });

    it("can retrieve apps for account", () => {
      const app: storageTypes.App = utils.makeStorageApp();
      app.name = "my app";

      return storage
        .addApp(account.id, app)
        .then((addedApp: storageTypes.App) => {
          return storage.getApps(account.id);
        })
        .then((apps: storageTypes.App[]) => {
          assert.equal(1, apps.length);
          assert.equal(apps[0].name, "my app");
        });
    });

    it("can retrieve empty app list for account", () => {
      return storage.getApps(account.id).then((apps: storageTypes.App[]) => {
        assert.equal(0, apps.length);
      });
    });

    it("rejects promise when retrieving by invalid account", () => {
      return storage.getApps("invalid").then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
        assert.equal(error.code, storageTypes.ErrorCode.NotFound);
      });
    });

    it("can remove an app", () => {
      const app: storageTypes.App = utils.makeStorageApp();
      const deployment: storageTypes.Deployment = utils.makeStorageDeployment();

      return storage
        .addApp(account.id, app)
        .then((addedApp: storageTypes.App) => {
          app.id = addedApp.id;
          return storage.addDeployment(account.id, app.id, deployment);
        })
        .then((deploymentId: string) => {
          deployment.id = deploymentId;
          return storage.removeApp(account.id, app.id);
        })
        .then(() => {
          return storage.getApp(account.id, app.id);
        })
        .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
          return storage.getDeployment(account.id, app.id, deployment.id);
        })
        .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
          return storage.getPackageHistoryFromDeploymentKey(deployment.key);
        })
        .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
        });
    });

    it("rejects promise when removing a non-existent app", () => {
      return storage.removeApp(account.id, "invalid").then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
        assert.equal(error.code, storageTypes.ErrorCode.NotFound);
      });
    });

    it("can update an app", () => {
      const app: storageTypes.App = utils.makeStorageApp();
      let appId: string;

      return storage
        .addApp(account.id, app)
        .then((addedApp: storageTypes.App) => {
          appId = addedApp.id;
          const updatedApp: storageTypes.App = utils.makeStorageApp();
          updatedApp.id = appId;
          updatedApp.name = "updated name";
          return storage.updateApp(account.id, updatedApp);
        })
        .then(() => {
          return storage.getApp(account.id, appId);
        })
        .then((retrievedApp: storageTypes.App) => {
          assert.equal(retrievedApp.name, "updated name");
        });
    });

    it("will reject promise when updating non-existent entry", () => {
      const app: storageTypes.App = utils.makeStorageApp();
      app.id = "non-existent";

      return storage.updateApp(account.id, app).then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
        assert.equal(error.code, storageTypes.ErrorCode.NotFound);
      });
    });

    it("addApp(...) will not modify the app argument", () => {
      const app: storageTypes.App = utils.makeStorageApp();
      const expectedResult: string = JSON.stringify(app);

      return storage.addApp(account.id, app).then((addedApp: storageTypes.App) => {
        const actualResult: string = JSON.stringify(app);

        assert.strictEqual(actualResult, expectedResult);
      });
    });

    it("updateApp(...) will not modify the app argument", () => {
      const app: storageTypes.App = utils.makeStorageApp();
      let appId: string;
      let updatedApp: storageTypes.App;
      let expectedResult: string;

      return storage
        .addApp(account.id, app)
        .then((addedApp: storageTypes.App) => {
          appId = addedApp.id;

          updatedApp = utils.makeStorageApp();
          updatedApp.id = appId;
          updatedApp.name = "updated name";

          expectedResult = JSON.stringify(updatedApp);

          return storage.updateApp(account.id, updatedApp);
        })
        .then(() => {
          const actualResult: string = JSON.stringify(updatedApp);

          assert.strictEqual(actualResult, expectedResult);
        });
    });

    describe("Transfer App", () => {
      let account2: storageTypes.Account;
      let account3: storageTypes.Account;
      let appToTransfer: storageTypes.App;

      beforeEach(() => {
        account2 = utils.makeAccount();
        return storage
          .addAccount(account2)
          .then((accountId: string) => {
            account2.id = accountId;
          })
          .then(() => {
            account3 = utils.makeAccount();
            return storage.addAccount(account3);
          })
          .then((accountId: string) => {
            account3.id = accountId;
          })
          .then(() => {
            appToTransfer = utils.makeStorageApp();
            return storage.addApp(account2.id, appToTransfer);
          })
          .then((addedApp: storageTypes.App) => {
            appToTransfer.id = addedApp.id;
          });
      });

      it("will reject promise when transferring to non-existent account", () => {
        return storage
          .transferApp(account2.id, appToTransfer.id, "nonexistent@email.com")
          .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
            assert.equal(error.code, storageTypes.ErrorCode.NotFound);
            assert.equal(error.message, collaboratorNotFoundMessage);
          });
      });

      it("will reject promise when transferring to own account", () => {
        return storage
          .transferApp(account2.id, appToTransfer.id, account2.email)
          .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
            assert.equal(error.code, storageTypes.ErrorCode.AlreadyExists);
          });
      });

      it("will successfully transfer app to new account", () => {
        return storage
          .getApps(account3.id)
          .then((apps: storageTypes.App[]) => {
            assert.equal(0, apps.length);
            return storage.transferApp(account2.id, appToTransfer.id, account3.email);
          })
          .then(() => {
            return storage.getApps(account2.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(1, apps.length);
            return storage.getApps(account3.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(1, apps.length);
          });
      });

      it("will successfully transfer app to existing collaborator", () => {
        return storage
          .getApps(account3.id)
          .then((apps: storageTypes.App[]) => {
            assert.equal(0, apps.length);
            return storage.addCollaborator(account2.id, appToTransfer.id, account3.email);
          })
          .then(() => {
            return storage.getApps(account3.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal("Owner", apps[0].collaborators[account2.email].permission);
            assert.equal("Collaborator", apps[0].collaborators[account3.email].permission);
            assert.equal(1, apps.length);
            return storage.transferApp(account2.id, appToTransfer.id, account3.email);
          })
          .then(() => {
            return storage.getApps(account3.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(1, apps.length);
            assert.equal("Owner", apps[0].collaborators[account3.email].permission);
            return storage.getApps(account2.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(1, apps.length);
            assert.equal("Collaborator", apps[0].collaborators[account2.email].permission);
          });
      });

      it("will successfully transfer app and not remove any collaborators for app", () => {
        return storage
          .getApps(account3.id)
          .then((apps: storageTypes.App[]) => {
            assert.equal(0, apps.length);
            return storage.addCollaborator(account2.id, appToTransfer.id, account3.email);
          })
          .then(() => {
            return storage.addCollaborator(account2.id, appToTransfer.id, account.email);
          })
          .then(() => {
            return storage.getApps(account3.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(1, apps.length);
            assert.equal(3, Object.keys(apps[0].collaborators).length);
            assert.equal("Owner", apps[0].collaborators[account2.email].permission);
            assert.equal("Collaborator", apps[0].collaborators[account3.email].permission);
            assert.equal("Collaborator", apps[0].collaborators[account.email].permission);
            return storage.transferApp(account2.id, appToTransfer.id, account3.email);
          })
          .then(() => {
            return storage.getApps(account3.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(1, apps.length);
            assert.equal(3, Object.keys(apps[0].collaborators).length);
            assert.equal("Collaborator", apps[0].collaborators[account2.email].permission);
            assert.equal("Owner", apps[0].collaborators[account3.email].permission);
            assert.equal("Collaborator", apps[0].collaborators[account.email].permission);
          });
      });
    });

    describe("Collaborator", () => {
      let account2: storageTypes.Account;
      let account3: storageTypes.Account;
      let appToTransfer: storageTypes.App;

      beforeEach(() => {
        account2 = utils.makeAccount();
        return storage
          .addAccount(account2)
          .then((accountId: string) => {
            account2.id = accountId;
          })
          .then(() => {
            account3 = utils.makeAccount();
            return storage.addAccount(account3);
          })
          .then((accountId: string) => {
            account3.id = accountId;
          })
          .then(() => {
            appToTransfer = utils.makeStorageApp();
            return storage.addApp(account2.id, appToTransfer);
          })
          .then((addedApp: storageTypes.App) => {
            appToTransfer.id = addedApp.id;
          });
      });

      it("add collaborator successfully", () => {
        return storage
          .getApps(account3.id)
          .then((apps: storageTypes.App[]) => {
            assert.equal(0, apps.length);
            return storage.addCollaborator(account2.id, appToTransfer.id, account3.email);
          })
          .then(() => {
            return storage.getApps(account3.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(1, apps.length);
            assert.equal(2, Object.keys(apps[0].collaborators).length);
          });
      });

      it("will reject promise when adding existing collaborator", () => {
        return storage
          .getApps(account3.id)
          .then((apps: storageTypes.App[]) => {
            assert.equal(0, apps.length);
            return storage.addCollaborator(account2.id, appToTransfer.id, account2.email);
          })
          .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
            assert.equal(error.code, storageTypes.ErrorCode.AlreadyExists);
          });
      });

      it("will reject promise when adding invalid collaborator account", () => {
        return storage
          .getApps(account3.id)
          .then((apps: storageTypes.App[]) => {
            assert.equal(0, apps.length);
            return storage.addCollaborator(account2.id, appToTransfer.id, "nonexistent@email.com");
          })
          .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
            assert.equal(error.code, storageTypes.ErrorCode.NotFound);
            assert.equal(error.message, collaboratorNotFoundMessage);
          });
      });

      it("get list of collaborators succesfully", () => {
        return storage
          .addCollaborator(account2.id, appToTransfer.id, account3.email)
          .then(() => {
            return storage.getCollaborators(account2.id, appToTransfer.id);
          })
          .then((collaboratorList: storageTypes.CollaboratorMap) => {
            const keys: string[] = Object.keys(collaboratorList);
            assert.equal(2, keys.length);
            assert.equal(account2.email, keys[0]);
            assert.equal(account3.email, keys[1]);
          });
      });

      it("remove collaborator successfully", () => {
        return storage
          .addCollaborator(account2.id, appToTransfer.id, account3.email)
          .then(() => {
            return storage.getCollaborators(account2.id, appToTransfer.id);
          })
          .then((collaboratorList: storageTypes.CollaboratorMap) => {
            assert.equal(2, Object.keys(collaboratorList).length);
            return storage.getApps(account3.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(1, apps.length);
            return storage.removeCollaborator(account2.id, appToTransfer.id, account3.email);
          })
          .then(() => {
            return storage.getCollaborators(account2.id, appToTransfer.id);
          })
          .then((collaboratorList: storageTypes.CollaboratorMap) => {
            assert.equal(1, Object.keys(collaboratorList).length);
            return storage.getApps(account3.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(0, apps.length);
          });
      });

      it("will allow collaborator to remove themselves successfully", () => {
        return storage
          .addCollaborator(account2.id, appToTransfer.id, account3.email)
          .then(() => {
            return storage.getCollaborators(account2.id, appToTransfer.id);
          })
          .then((collaboratorList: storageTypes.CollaboratorMap) => {
            assert.equal(2, Object.keys(collaboratorList).length);
            return storage.getApps(account3.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(1, apps.length);
            return storage.removeCollaborator(account3.id, appToTransfer.id, account3.email);
          })
          .then(() => {
            return storage.getCollaborators(account2.id, appToTransfer.id);
          })
          .then((collaboratorList: storageTypes.CollaboratorMap) => {
            assert.equal(1, Object.keys(collaboratorList).length);
            return storage.getApps(account3.id);
          })
          .then((apps: storageTypes.App[]) => {
            assert.equal(0, apps.length);
          });
      });
    });
  });

  describe("Deployment", () => {
    let account: storageTypes.Account;
    let app: storageTypes.App;

    beforeEach(() => {
      account = utils.makeAccount();
      app = utils.makeStorageApp();
      return storage
        .addAccount(account)
        .then((accountId: string) => {
          account.id = accountId;
          return storage.addApp(account.id, app);
        })
        .then((addedApp: storageTypes.App) => {
          app.id = addedApp.id;
        });
    });

    it("can add a deployment", () => {
      const deployment: storageTypes.Deployment = utils.makeStorageDeployment();

      return storage.addDeployment(account.id, app.id, deployment).then((deploymentId: string) => {
        assert(deploymentId);
      });
    });

    it("add deployment creates empty package history", () => {
      const deployment: storageTypes.Deployment = utils.makeStorageDeployment();

      return storage
        .addDeployment(account.id, app.id, deployment)
        .then((deploymentId: string) => {
          assert(deploymentId);
          return storage.getPackageHistory(account.id, app.id, deploymentId);
        })
        .then((history: storageTypes.Package[]) => {
          assert.equal(history.length, 0);
        });
    });

    it("rejects promise when adding to a non-existent app", () => {
      const deployment: storageTypes.Deployment = utils.makeStorageDeployment();

      return storage
        .addDeployment(account.id, "non-existent", deployment)
        .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
        });
    });

    it("rejects promise with an invalid deploymentId", () => {
      return storage.getDeployment(account.id, app.id, "invalid").then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
        assert.equal(error.code, storageTypes.ErrorCode.NotFound);
      });
    });

    it("can get a deployment with an account id & deployment id", () => {
      const deployment: storageTypes.Deployment = utils.makeStorageDeployment();
      deployment.name = "deployment123";

      return storage
        .addDeployment(account.id, app.id, deployment)
        .then((deploymentId: string) => {
          return storage.getDeployment(account.id, app.id, deploymentId);
        })
        .then((deployment: storageTypes.Deployment) => {
          assert.equal(deployment.name, "deployment123");
        });
    });

    it("can retrieve deployments for account id & app id", () => {
      const deployment: storageTypes.Deployment = utils.makeStorageDeployment();
      deployment.name = "deployment123";

      return storage
        .addDeployment(account.id, app.id, deployment)
        .then((deploymentId: string) => {
          return storage.getDeployments(account.id, app.id);
        })
        .then((deployments: storageTypes.Deployment[]) => {
          assert.equal(deployments.length, 1);
          assert.equal("deployment123", deployments[0].name);
        });
    });

    it("can retrieve empty deployment list for account", () => {
      const deployment: storageTypes.Deployment = utils.makeStorageDeployment();
      deployment.name = "deployment123";

      return storage.getDeployments(account.id, app.id).then((deployments: storageTypes.Deployment[]) => {
        assert.equal(0, deployments.length);
      });
    });

    it("rejects promise when retrieving by invalid app", () => {
      const deployment: storageTypes.Deployment = utils.makeStorageDeployment();
      deployment.name = "deployment123";

      return storage.getDeployments(account.id, "invalid").then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
        assert.equal(error.code, storageTypes.ErrorCode.NotFound);
      });
    });

    it("can remove a deployment", () => {
      const deployment: storageTypes.Deployment = utils.makeStorageDeployment();

      return storage
        .addDeployment(account.id, app.id, deployment)
        .then((deploymentId: string) => {
          deployment.id = deploymentId;
          return storage.removeDeployment(account.id, app.id, deployment.id);
        })
        .then(() => {
          return storage.getDeployment(account.id, app.id, deployment.id);
        })
        .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
          return storage.getPackageHistoryFromDeploymentKey(deployment.key);
        })
        .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
          return storage.getPackageHistory(account.id, app.id, deployment.id);
        })
        .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
          return storage.getApp(account.id, app.id);
        })
        .then((returnedApp: storageTypes.App) => {
          assert.equal(app.name, returnedApp.name);
        });
    });

    it("rejects promise when removing a non-existent deployment", () => {
      return storage.removeDeployment(account.id, app.id, "invalid").then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
        assert.equal(error.code, storageTypes.ErrorCode.NotFound);
      });
    });

    it("can update a deployment", () => {
      const deployment: storageTypes.Deployment = utils.makeStorageDeployment();
      let deploymentId: string;

      return storage
        .addDeployment(account.id, app.id, deployment)
        .then((addedDeploymentId: string) => {
          deploymentId = addedDeploymentId;
          const updatedDeployment: storageTypes.Deployment = utils.makeStorageDeployment();
          updatedDeployment.id = deploymentId;
          updatedDeployment.name = "updated name";
          return storage.updateDeployment(account.id, app.id, updatedDeployment);
        })
        .then(() => {
          return storage.getDeployment(account.id, app.id, deploymentId);
        })
        .then((retrievedDeployment: storageTypes.Deployment) => {
          assert.equal(retrievedDeployment.name, "updated name");
        });
    });

    it("will reject promise when updating non-existent entry", () => {
      const deployment: storageTypes.Deployment = utils.makeStorageDeployment();
      deployment.id = "non-existent";

      return storage.updateDeployment(account.id, app.id, deployment).then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
        assert.equal(error.code, storageTypes.ErrorCode.NotFound);
      });
    });

    it("addDeployment(...) will not modify the deployment argument", () => {
      const deployment: storageTypes.Deployment = utils.makeStorageDeployment();
      const expectedResult: string = JSON.stringify(deployment);

      return storage.addDeployment(account.id, app.id, deployment).then((deploymentId: string) => {
        const actualResult: string = JSON.stringify(deployment);

        assert.strictEqual(actualResult, expectedResult);
      });
    });

    it("updateDeployment(...) will not modify the deployment argument", () => {
      const deployment: storageTypes.Deployment = utils.makeStorageDeployment();
      let deploymentId: string;
      let updatedDeployment: storageTypes.Deployment;
      let expectedResult: string;

      return storage
        .addDeployment(account.id, app.id, deployment)
        .then((addedDeploymentId: string) => {
          deploymentId = addedDeploymentId;

          updatedDeployment = utils.makeStorageDeployment();
          updatedDeployment.id = deploymentId;
          updatedDeployment.name = "updated name";

          expectedResult = JSON.stringify(updatedDeployment);

          return storage.updateDeployment(account.id, app.id, updatedDeployment);
        })
        .then((): void => {
          const actualResult: string = JSON.stringify(updatedDeployment);

          assert.strictEqual(actualResult, expectedResult);
        });
    });
  });

  describe("DeploymentInfo", () => {
    let account: storageTypes.Account;
    let app: storageTypes.App;
    let deployment: storageTypes.Deployment;

    beforeEach(() => {
      account = utils.makeAccount();
      app = utils.makeStorageApp();

      return storage
        .addAccount(account)
        .then((accountId: string): Promise<storageTypes.App> => {
          account.id = accountId;

          return storage.addApp(account.id, app);
        })
        .then((addedApp: storageTypes.App): Promise<string> => {
          app.id = addedApp.id;
          deployment = utils.makeStorageDeployment();

          return storage.addDeployment(account.id, app.id, deployment);
        })
        .then((deploymentId: string): void => {
          deployment.id = deploymentId;
        });
    });

    it("can get app and deployment ID's", () => {
      return storage.getDeploymentInfo(deployment.key).then((deploymentInfo: storageTypes.DeploymentInfo): void => {
        assert(deploymentInfo);
        assert.equal(deploymentInfo.appId, app.id);
        assert.equal(deploymentInfo.deploymentId, deployment.id);
      });
    });
  });

  describe("Package", () => {
    let account: storageTypes.Account;
    let app: storageTypes.App;
    let deployment: storageTypes.Deployment;
    let blobId: string;
    let blobUrl: string;

    beforeEach(() => {
      account = utils.makeAccount();
      return storage
        .addAccount(account)
        .then((accountId: string) => {
          account.id = accountId;
          app = utils.makeStorageApp();
          return storage.addApp(account.id, app);
        })
        .then((addedApp: storageTypes.App) => {
          app.id = addedApp.id;
          deployment = utils.makeStorageDeployment();
          return storage.addDeployment(account.id, app.id, deployment);
        })
        .then((deploymentId: string) => {
          deployment.id = deploymentId;
          const fileContents = "test blob";
          return storage.addBlob(shortid.generate(), utils.makeStreamFromString(fileContents), fileContents.length);
        })
        .then((savedBlobId: string) => {
          blobId = savedBlobId;
          return storage.getBlobUrl(blobId);
        })
        .then((savedBlobUrl: string) => {
          blobUrl = savedBlobUrl;
        });
    });

    it("can get empty package", () => {
      return storage.getDeployment(account.id, app.id, deployment.id).then((deployment: storageTypes.Deployment) => {
        assert.equal(deployment.package, null);
      });
    });

    it("can add and get a package", () => {
      const storagePackage: storageTypes.Package = utils.makePackage();
      storagePackage.blobUrl = blobUrl;
      storagePackage.description = "description123";

      return storage
        .commitPackage(account.id, app.id, deployment.id, storagePackage)
        .then(() => {
          return storage.getPackageHistoryFromDeploymentKey(deployment.key);
        })
        .then((deploymentPackages: storageTypes.Package[]) => {
          assert.equal("description123", deploymentPackages[deploymentPackages.length - 1].description);
        });
    });

    it("rejects promise with a non-existent deploymentKey", () => {
      return storage
        .getPackageHistoryFromDeploymentKey("NonExistentDeploymentKey")
        .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
          assert.equal(error.code, storageTypes.ErrorCode.NotFound);
        });
    });

    it("transferApp still returns history from deploymentKey", () => {
      const storagePackage: storageTypes.Package = utils.makePackage();
      const account2: storageTypes.Account = utils.makeAccount();
      storagePackage.blobUrl = blobUrl;
      storagePackage.description = "description123";

      return storage
        .commitPackage(account.id, app.id, deployment.id, storagePackage)
        .then(() => {
          return storage.getPackageHistoryFromDeploymentKey(deployment.key);
        })
        .then((deploymentPackages: storageTypes.Package[]) => {
          assert.equal("description123", deploymentPackages[deploymentPackages.length - 1].description);
          return storage.addAccount(account2);
        })
        .then((accountId: string) => {
          account2.id = accountId;
          return storage.transferApp(account.id, app.id, account2.email);
        })
        .then(() => {
          return storage.removeCollaborator(account.id, app.id, account.email);
        })
        .then(() => {
          return storage.getPackageHistoryFromDeploymentKey(deployment.key);
        })
        .then((deploymentPackages: storageTypes.Package[]) => {
          assert.equal("description123", deploymentPackages[deploymentPackages.length - 1].description);
        });
    });

    if (storage instanceof AzureStorage) {
      it("raises error on uncaught injection attempt", () => {
        assert.throws(() => {
          storage.getPackageHistoryFromDeploymentKey("possible injection attempt");
        });
      });
    }

    it("commitPackage(...) will not modify the appPackage argument", () => {
      const storagePackage: storageTypes.Package = utils.makePackage();

      storagePackage.blobUrl = blobUrl;
      storagePackage.description = "description123";

      const expectedResult: string = JSON.stringify(storagePackage);

      return storage.commitPackage(account.id, app.id, deployment.id, storagePackage).then((): void => {
        const actualResult: string = JSON.stringify(storagePackage);

        assert.strictEqual(actualResult, expectedResult);
      });
    });

    describe("Package history", () => {
      let expectedPackageHistory: storageTypes.Package[];

      beforeEach(() => {
        expectedPackageHistory = [];
        let promiseChain: Promise<void> = Promise.resolve(null);
        let packageNumber = 1;
        for (let i = 1; i <= 3; i++) {
          promiseChain = promiseChain
            .then(() => {
              const newPackage: storageTypes.Package = utils.makePackage();
              newPackage.blobUrl = blobUrl;
              newPackage.description = shortid.generate();
              expectedPackageHistory.push(newPackage);
              return storage.commitPackage(account.id, app.id, deployment.id, newPackage);
            })
            .then((committedPackage: storageTypes.Package) => {
              const lastPackage: storageTypes.Package = expectedPackageHistory[expectedPackageHistory.length - 1];
              lastPackage.label = "v" + packageNumber++;
              lastPackage.releasedBy = committedPackage.releasedBy;
            });
        }

        return promiseChain;
      });

      it("can get package history", () => {
        return storage.getPackageHistory(account.id, app.id, deployment.id).then((actualPackageHistory: storageTypes.Package[]) => {
          assert.equal(JSON.stringify(actualPackageHistory), JSON.stringify(expectedPackageHistory));
        });
      });

      it("can update package history", () => {
        return storage
          .getPackageHistory(account.id, app.id, deployment.id)
          .then((actualPackageHistory: storageTypes.Package[]) => {
            assert.equal(JSON.stringify(actualPackageHistory), JSON.stringify(expectedPackageHistory));
            expectedPackageHistory[0].description = "new description for v1";
            expectedPackageHistory[1].isMandatory = true;
            expectedPackageHistory[2].description = "new description for v3";
            expectedPackageHistory[2].isMandatory = false;
            expectedPackageHistory[2].isDisabled = true;
            return storage.updatePackageHistory(account.id, app.id, deployment.id, expectedPackageHistory);
          })
          .then(() => {
            return storage.getPackageHistory(account.id, app.id, deployment.id);
          })
          .then((actualPackageHistory: storageTypes.Package[]) => {
            assert.equal(JSON.stringify(actualPackageHistory), JSON.stringify(expectedPackageHistory));
          });
      });

      it("updatePackageHistory does not clear package history", () => {
        return storage
          .getPackageHistory(account.id, app.id, deployment.id)
          .then((actualPackageHistory: storageTypes.Package[]) => {
            assert.equal(JSON.stringify(actualPackageHistory), JSON.stringify(expectedPackageHistory));
            return storage.updatePackageHistory(account.id, app.id, deployment.id, /*history*/ null);
          })
          .then(failOnCallSucceeded, (error: storageTypes.StorageError) => {
            assert.equal(error.code, storageTypes.ErrorCode.Invalid);
            return storage.getPackageHistory(account.id, app.id, deployment.id);
          })
          .then((actualPackageHistory: storageTypes.Package[]) => {
            assert.equal(JSON.stringify(actualPackageHistory), JSON.stringify(expectedPackageHistory));
          });
      });
    });
  });

  describe("Blob", () => {
    it("can add a blob", () => {
      const fileContents = "test stream";
      return storage
        .addBlob(shortid.generate(), utils.makeStreamFromString(fileContents), fileContents.length)
        .then((blobId: string) => {
          assert(blobId);
        });
    });

    it("can get a blob url", () => {
      const fileContents = "test stream";
      return storage
        .addBlob(shortid.generate(), utils.makeStreamFromString(fileContents), fileContents.length)
        .then((blobId: string) => {
          return storage.getBlobUrl(blobId);
        })
        .then((blobUrl: string) => {
          assert(blobUrl);
          return utils.retrieveStringContentsFromUrl(blobUrl);
        })
        .then((actualContents: string) => {
          assert.equal(fileContents, actualContents);
        });
    });

    it("can remove a blob", (done) => {
      const fileContents = "test stream";
      let blobId: string;
      storage
        .addBlob(shortid.generate(), utils.makeStreamFromString(fileContents), fileContents.length)
        .then((id: string) => {
          blobId = id;
          return storage.removeBlob(blobId);
        })
        .then(() => {
          return storage.getBlobUrl(blobId);
        })
        .then((blobUrl: string) => {
          if (!blobUrl) {
            return null;
          }
          console.warn("Blob URL: ", blobUrl);
          return utils.retrieveStringContentsFromUrl(blobUrl);
        })
        // .timeout(1000, "timeout")
        .then(
          (retrievedContents: string) => {
            console.warn("Blob URL: ", retrievedContents);
            assert.equal(null, retrievedContents);
          },
          (error: any) => {
            console.warn("Error: ", error);
            if (error instanceof Error) {
              assert.equal(error.message, "timeout");
            } else {
              throw error;
            }
          }
        )
        .then(() => done());
    });
  });
}

function failOnCallSucceeded(result: any): any {
  throw new Error("Expected the promise to be rejected, but it succeeded with value " + (result ? JSON.stringify(result) : result));
}
