## `ISwap`






### `swap(struct Types.Order order)` (external)

Atomic Token Swap




### `cancel(uint256[] nonces)` (external)

Cancel one or more open orders by nonce




### `cancelUpTo(uint256 minimumNonce)` (external)

Cancels all orders below a nonce value


These orders can be made active by reducing the minimum nonce


### `authorizeSender(address authorizedSender)` (external)

Authorize a delegated sender




### `authorizeSigner(address authorizedSigner)` (external)

Authorize a delegated signer




### `revokeSender(address authorizedSender)` (external)

Revoke an authorization




### `revokeSigner(address authorizedSigner)` (external)

Revoke an authorization




### `senderAuthorizations(address, address) → bool` (external)





### `signerAuthorizations(address, address) → bool` (external)





### `signerNonceStatus(address, uint256) → bytes1` (external)





### `signerMinimumNonce(address) → uint256` (external)





### `registry() → address` (external)






### `Swap(uint256 nonce, uint256 timestamp, address signerWallet, uint256 signerAmount, uint256 signerId, address signerToken, address senderWallet, uint256 senderAmount, uint256 senderId, address senderToken, address affiliateWallet, uint256 affiliateAmount, uint256 affiliateId, address affiliateToken)`





### `Cancel(uint256 nonce, address signerWallet)`





### `CancelUpTo(uint256 nonce, address signerWallet)`





### `AuthorizeSender(address authorizerAddress, address authorizedSender)`





### `AuthorizeSigner(address authorizerAddress, address authorizedSigner)`





### `RevokeSender(address authorizerAddress, address revokedSender)`





### `RevokeSigner(address authorizerAddress, address revokedSigner)`





