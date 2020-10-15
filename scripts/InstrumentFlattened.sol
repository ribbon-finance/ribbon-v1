// File: @openzeppelin/contracts/utils/ReentrancyGuard.sol

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 private _status;

    constructor () internal {
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and make it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        // On the first call to nonReentrant, _notEntered will be true
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");

        // Any calls to nonReentrant after this point will fail
        _status = _ENTERED;

        _;

        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = _NOT_ENTERED;
    }
}

// File: @openzeppelin/contracts/token/ERC20/IERC20.sol


pragma solidity ^0.6.0;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `recipient`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `sender` to `recipient` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

// File: @openzeppelin/contracts/math/SafeMath.sol


pragma solidity ^0.6.0;

/**
 * @dev Wrappers over Solidity's arithmetic operations with added overflow
 * checks.
 *
 * Arithmetic operations in Solidity wrap on overflow. This can easily result
 * in bugs, because programmers usually assume that an overflow raises an
 * error, which is the standard behavior in high level programming languages.
 * `SafeMath` restores this intuition by reverting the transaction when an
 * operation overflows.
 *
 * Using this library instead of the unchecked operations eliminates an entire
 * class of bugs, so it's recommended to use it always.
 */
library SafeMath {
    /**
     * @dev Returns the addition of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     *
     * - Addition cannot overflow.
     */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     *
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting with custom message on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     *
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    /**
     * @dev Returns the multiplication of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `*` operator.
     *
     * Requirements:
     *
     * - Multiplication cannot overflow.
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts with custom message on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b > 0, errorMessage);
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, "SafeMath: modulo by zero");
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts with custom message when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }
}

// File: @openzeppelin/contracts/utils/Address.sol

pragma solidity ^0.6.2;

/**
 * @dev Collection of functions related to the address type
 */
library Address {
    /**
     * @dev Returns true if `account` is a contract.
     *
     * [IMPORTANT]
     * ====
     * It is unsafe to assume that an address for which this function returns
     * false is an externally-owned account (EOA) and not a contract.
     *
     * Among others, `isContract` will return false for the following
     * types of addresses:
     *
     *  - an externally-owned account
     *  - a contract in construction
     *  - an address where a contract will be created
     *  - an address where a contract lived, but was destroyed
     * ====
     */
    function isContract(address account) internal view returns (bool) {
        // This method relies in extcodesize, which returns 0 for contracts in
        // construction, since the code is only stored at the end of the
        // constructor execution.

        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly { size := extcodesize(account) }
        return size > 0;
    }

    /**
     * @dev Replacement for Solidity's `transfer`: sends `amount` wei to
     * `recipient`, forwarding all available gas and reverting on errors.
     *
     * https://eips.ethereum.org/EIPS/eip-1884[EIP1884] increases the gas cost
     * of certain opcodes, possibly making contracts go over the 2300 gas limit
     * imposed by `transfer`, making them unable to receive funds via
     * `transfer`. {sendValue} removes this limitation.
     *
     * https://diligence.consensys.net/posts/2019/09/stop-using-soliditys-transfer-now/[Learn more].
     *
     * IMPORTANT: because control is transferred to `recipient`, care must be
     * taken to not create reentrancy vulnerabilities. Consider using
     * {ReentrancyGuard} or the
     * https://solidity.readthedocs.io/en/v0.5.11/security-considerations.html#use-the-checks-effects-interactions-pattern[checks-effects-interactions pattern].
     */
    function sendValue(address payable recipient, uint256 amount) internal {
        require(address(this).balance >= amount, "Address: insufficient balance");

        // solhint-disable-next-line avoid-low-level-calls, avoid-call-value
        (bool success, ) = recipient.call{ value: amount }("");
        require(success, "Address: unable to send value, recipient may have reverted");
    }

    /**
     * @dev Performs a Solidity function call using a low level `call`. A
     * plain`call` is an unsafe replacement for a function call: use this
     * function instead.
     *
     * If `target` reverts with a revert reason, it is bubbled up by this
     * function (like regular Solidity function calls).
     *
     * Returns the raw returned data. To convert to the expected return value,
     * use https://solidity.readthedocs.io/en/latest/units-and-global-variables.html?highlight=abi.decode#abi-encoding-and-decoding-functions[`abi.decode`].
     *
     * Requirements:
     *
     * - `target` must be a contract.
     * - calling `target` with `data` must not revert.
     *
     * _Available since v3.1._
     */
    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
      return functionCall(target, data, "Address: low-level call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`], but with
     * `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCall(address target, bytes memory data, string memory errorMessage) internal returns (bytes memory) {
        return _functionCallWithValue(target, data, 0, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but also transferring `value` wei to `target`.
     *
     * Requirements:
     *
     * - the calling contract must have an ETH balance of at least `value`.
     * - the called Solidity function must be `payable`.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        return functionCallWithValue(target, data, value, "Address: low-level call with value failed");
    }

    /**
     * @dev Same as {xref-Address-functionCallWithValue-address-bytes-uint256-}[`functionCallWithValue`], but
     * with `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(address target, bytes memory data, uint256 value, string memory errorMessage) internal returns (bytes memory) {
        require(address(this).balance >= value, "Address: insufficient balance for call");
        return _functionCallWithValue(target, data, value, errorMessage);
    }

    function _functionCallWithValue(address target, bytes memory data, uint256 weiValue, string memory errorMessage) private returns (bytes memory) {
        require(isContract(target), "Address: call to non-contract");

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returndata) = target.call{ value: weiValue }(data);
        if (success) {
            return returndata;
        } else {
            // Look for revert reason and bubble it up if present
            if (returndata.length > 0) {
                // The easiest way to bubble the revert reason is using memory via assembly

                // solhint-disable-next-line no-inline-assembly
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert(errorMessage);
            }
        }
    }
}

// File: @openzeppelin/contracts/token/ERC20/SafeERC20.sol


pragma solidity ^0.6.0;




/**
 * @title SafeERC20
 * @dev Wrappers around ERC20 operations that throw on failure (when the token
 * contract returns false). Tokens that return no value (and instead revert or
 * throw on failure) are also supported, non-reverting calls are assumed to be
 * successful.
 * To use this library you can add a `using SafeERC20 for IERC20;` statement to your contract,
 * which allows you to call the safe operations as `token.safeTransfer(...)`, etc.
 */
library SafeERC20 {
    using SafeMath for uint256;
    using Address for address;

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeWithSelector(token.transfer.selector, to, value));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeWithSelector(token.transferFrom.selector, from, to, value));
    }

    /**
     * @dev Deprecated. This function has issues similar to the ones found in
     * {IERC20-approve}, and its usage is discouraged.
     *
     * Whenever possible, use {safeIncreaseAllowance} and
     * {safeDecreaseAllowance} instead.
     */
    function safeApprove(IERC20 token, address spender, uint256 value) internal {
        // safeApprove should only be called when setting an initial allowance,
        // or when resetting it to zero. To increase and decrease it, use
        // 'safeIncreaseAllowance' and 'safeDecreaseAllowance'
        // solhint-disable-next-line max-line-length
        require((value == 0) || (token.allowance(address(this), spender) == 0),
            "SafeERC20: approve from non-zero to non-zero allowance"
        );
        _callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, value));
    }

    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 newAllowance = token.allowance(address(this), spender).add(value);
        _callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, newAllowance));
    }

    function safeDecreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 newAllowance = token.allowance(address(this), spender).sub(value, "SafeERC20: decreased allowance below zero");
        _callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, newAllowance));
    }

    /**
     * @dev Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
     * on the return value: the return value is optional (but if data is returned, it must not be false).
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     */
    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        // We need to perform a low level call here, to bypass Solidity's return data size checking mechanism, since
        // we're implementing it ourselves. We use {Address.functionCall} to perform this call, which verifies that
        // the target address contains contract code and also asserts for success in the low-level call.

        bytes memory returndata = address(token).functionCall(data, "SafeERC20: low-level call failed");
        if (returndata.length > 0) { // Return data is optional
            // solhint-disable-next-line max-line-length
            require(abi.decode(returndata, (bool)), "SafeERC20: ERC20 operation did not succeed");
        }
    }
}

// File: @openzeppelin/contracts/GSN/Context.sol


pragma solidity ^0.6.0;

/*
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with GSN meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address payable) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes memory) {
        this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
        return msg.data;
    }
}

// File: @openzeppelin/contracts/token/ERC20/ERC20.sol


pragma solidity ^0.6.0;





/**
 * @dev Implementation of the {IERC20} interface.
 *
 * This implementation is agnostic to the way tokens are created. This means
 * that a supply mechanism has to be added in a derived contract using {_mint}.
 * For a generic mechanism see {ERC20PresetMinterPauser}.
 *
 * TIP: For a detailed writeup see our guide
 * https://forum.zeppelin.solutions/t/how-to-implement-erc20-supply-mechanisms/226[How
 * to implement supply mechanisms].
 *
 * We have followed general OpenZeppelin guidelines: functions revert instead
 * of returning `false` on failure. This behavior is nonetheless conventional
 * and does not conflict with the expectations of ERC20 applications.
 *
 * Additionally, an {Approval} event is emitted on calls to {transferFrom}.
 * This allows applications to reconstruct the allowance for all accounts just
 * by listening to said events. Other implementations of the EIP may not emit
 * these events, as it isn't required by the specification.
 *
 * Finally, the non-standard {decreaseAllowance} and {increaseAllowance}
 * functions have been added to mitigate the well-known issues around setting
 * allowances. See {IERC20-approve}.
 */
contract ERC20 is Context, IERC20 {
    using SafeMath for uint256;
    using Address for address;

    mapping (address => uint256) private _balances;

    mapping (address => mapping (address => uint256)) private _allowances;

    uint256 private _totalSupply;

    string private _name;
    string private _symbol;
    uint8 private _decimals;

    /**
     * @dev Sets the values for {name} and {symbol}, initializes {decimals} with
     * a default value of 18.
     *
     * To select a different value for {decimals}, use {_setupDecimals}.
     *
     * All three of these values are immutable: they can only be set once during
     * construction.
     */
    constructor (string memory name, string memory symbol) public {
        _name = name;
        _symbol = symbol;
        _decimals = 18;
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public view returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5,05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei. This is the value {ERC20} uses, unless {_setupDecimals} is
     * called.
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() public view returns (uint8) {
        return _decimals;
    }

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account];
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `recipient` cannot be the zero address.
     * - the caller must have a balance of at least `amount`.
     */
    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    /**
     * @dev See {IERC20-allowance}.
     */
    function allowance(address owner, address spender) public view virtual override returns (uint256) {
        return _allowances[owner][spender];
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 amount) public virtual override returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of {ERC20};
     *
     * Requirements:
     * - `sender` and `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     * - the caller must have allowance for ``sender``'s tokens of at least
     * `amount`.
     */
    function transferFrom(address sender, address recipient, uint256 amount) public virtual override returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(sender, _msgSender(), _allowances[sender][_msgSender()].sub(amount, "ERC20: transfer amount exceeds allowance"));
        return true;
    }

    /**
     * @dev Atomically increases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
        _approve(_msgSender(), spender, _allowances[_msgSender()][spender].add(addedValue));
        return true;
    }

    /**
     * @dev Atomically decreases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     * - `spender` must have allowance for the caller of at least
     * `subtractedValue`.
     */
    function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
        _approve(_msgSender(), spender, _allowances[_msgSender()][spender].sub(subtractedValue, "ERC20: decreased allowance below zero"));
        return true;
    }

    /**
     * @dev Moves tokens `amount` from `sender` to `recipient`.
     *
     * This is internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * Requirements:
     *
     * - `sender` cannot be the zero address.
     * - `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     */
    function _transfer(address sender, address recipient, uint256 amount) internal virtual {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        _beforeTokenTransfer(sender, recipient, amount);

        _balances[sender] = _balances[sender].sub(amount, "ERC20: transfer amount exceeds balance");
        _balances[recipient] = _balances[recipient].add(amount);
        emit Transfer(sender, recipient, amount);
    }

    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements
     *
     * - `to` cannot be the zero address.
     */
    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: mint to the zero address");

        _beforeTokenTransfer(address(0), account, amount);

        _totalSupply = _totalSupply.add(amount);
        _balances[account] = _balances[account].add(amount);
        emit Transfer(address(0), account, amount);
    }

    /**
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * Requirements
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     */
    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: burn from the zero address");

        _beforeTokenTransfer(account, address(0), amount);

        _balances[account] = _balances[account].sub(amount, "ERC20: burn amount exceeds balance");
        _totalSupply = _totalSupply.sub(amount);
        emit Transfer(account, address(0), amount);
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over the `owner` s tokens.
     *
     * This internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     */
    function _approve(address owner, address spender, uint256 amount) internal virtual {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    /**
     * @dev Sets {decimals} to a value other than the default one of 18.
     *
     * WARNING: This function should only be called from the constructor. Most
     * applications that interact with token contracts will not expect
     * {decimals} to ever change, and may work incorrectly if it does.
     */
    function _setupDecimals(uint8 decimals_) internal {
        _decimals = decimals_;
    }

    /**
     * @dev Hook that is called before any transfer of tokens. This includes
     * minting and burning.
     *
     * Calling conditions:
     *
     * - when `from` and `to` are both non-zero, `amount` of ``from``'s tokens
     * will be to transferred to `to`.
     * - when `from` is zero, `amount` tokens will be minted for `to`.
     * - when `to` is zero, `amount` of ``from``'s tokens will be burned.
     * - `from` and `to` are never both zero.
     *
     * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
     */
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual { }
}

// File: @openzeppelin/contracts/access/Ownable.sol


pragma solidity ^0.6.0;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that deploys the contract. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor () internal {
        address msgSender = _msgSender();
        _owner = msgSender;
        emit OwnershipTransferred(address(0), msgSender);
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(_owner == _msgSender(), "Ownable: caller is not the owner");
        _;
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions anymore. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}

// File: contracts/DToken.sol

pragma solidity >=0.6.0;



contract DToken is ERC20, Ownable {
    constructor(string memory _name, string memory _symbol)
        public
        ERC20(_name, _symbol)
    {}

    /**
     * @notice Function to mint new dTokens when opening vaults
     * @param to is the recipient of the newly minted tokens
     * @param amount is the mint amount 
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice Function to burn dTokens from supply during redemption and debt repayment
     * @param from is the address to burn tokens from
     * @param amount is the burn amount
     */
    function burn(address from, uint256 amount) public onlyOwner {
        require(balanceOf(from) >= amount, "Cannot burn more than account balance");
        _burn(from, amount);
    }

    /**
     * @notice Getter to return the instrument the token is tied to
     */
    function dojimaInstrument() public view returns (address) {
        // The instrument is the owner of the token
        return owner();
    }
}

// File: contracts/DataProviderInterface.sol

pragma solidity ^0.6.2;

interface DataProviderInterface {
   function getPrice(address _asset) external view returns(uint);
}

// File: contracts/lib/DSMath.sol


/// math.sol -- mixin for inline numerical wizardry

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity >0.4.13;

contract DSMath {
    function add(uint x, uint y) internal pure returns (uint z) {
        require((z = x + y) >= x, "ds-math-add-overflow");
    }
    function sub(uint x, uint y) internal pure returns (uint z) {
        require((z = x - y) <= x, "ds-math-sub-underflow");
    }
    function mul(uint x, uint y) internal pure returns (uint z) {
        require(y == 0 || (z = x * y) / y == x, "ds-math-mul-overflow");
    }

    function min(uint x, uint y) internal pure returns (uint z) {
        return x <= y ? x : y;
    }
    function max(uint x, uint y) internal pure returns (uint z) {
        return x >= y ? x : y;
    }
    function imin(int x, int y) internal pure returns (int z) {
        return x <= y ? x : y;
    }
    function imax(int x, int y) internal pure returns (int z) {
        return x >= y ? x : y;
    }

    uint constant WAD = 10 ** 18;
    uint constant RAY = 10 ** 27;

    //rounds to zero if x*y < WAD / 2
    function wmul(uint x, uint y) internal pure returns (uint z) {
        z = add(mul(x, y), WAD / 2) / WAD;
    }
    //rounds to zero if x*y < WAD / 2
    function rmul(uint x, uint y) internal pure returns (uint z) {
        z = add(mul(x, y), RAY / 2) / RAY;
    }
    //rounds to zero if x*y < WAD / 2
    function wdiv(uint x, uint y) internal pure returns (uint z) {
        z = add(mul(x, WAD), y / 2) / y;
    }
    //rounds to zero if x*y < RAY / 2
    function rdiv(uint x, uint y) internal pure returns (uint z) {
        z = add(mul(x, RAY), y / 2) / y;
    }

    // This famous algorithm is called "exponentiation by squaring"
    // and calculates x^n with x as fixed-point and n as regular unsigned.
    //
    // It's O(log n), instead of O(n) for naive repeated multiplication.
    //
    // These facts are why it works:
    //
    //  If n is even, then x^n = (x^2)^(n/2).
    //  If n is odd,  then x^n = x * x^(n-1),
    //   and applying the equation for even x gives
    //    x^n = x * (x^2)^((n-1) / 2).
    //
    //  Also, EVM division is flooring and
    //    floor[(n-1) / 2] = floor[n / 2].
    //
    function rpow(uint x, uint n) internal pure returns (uint z) {
        z = n % 2 != 0 ? x : RAY;

        for (n /= 2; n != 0; n /= 2) {
            x = rmul(x, x);

            if (n % 2 != 0) {
                z = rmul(z, x);
            }
        }
    }
}

// File: contracts/DojimaInstrument.sol

pragma solidity >=0.6.0;







contract DojimaInstrument is ReentrancyGuard, DSMath {
    using SafeERC20 for IERC20;

    string public name;
    string public symbol;
    uint public expiry;
    uint public collateralizationRatio;
    address public collateralAsset;
    address public targetAsset;
    address public dToken;
    address public dataProvider;
    bool public expired;
    uint public settlePrice;
    address public liquidatorProxy;
    uint public totalDebt;

    constructor(
        address _dataProvider,
        string memory _name,
        string memory _symbol,
        uint _expiry,
        uint _collateralizationRatio,
        address _collateralAsset,
        address _targetAsset,
        address _liquidatorProxy
    ) public {
        require(block.timestamp < _expiry, "Expiry has already passed");

        name = _name;
        symbol = _symbol;
        expiry = _expiry;
        collateralizationRatio = _collateralizationRatio;
        collateralAsset = _collateralAsset;
        targetAsset = _targetAsset;
        dataProvider = _dataProvider;
        liquidatorProxy = _liquidatorProxy;

        // Init new DToken
        DToken newDToken = new DToken(_name, _symbol);
        dToken = address(newDToken);

        expired = false;
    }
   
    /**
     * @notice Vault struct contains collateral and dToken debt
     */
    struct Vault {
        uint collateral;
        uint dTokenDebt;
    }

    /**
     * @notice Mapping between an address and a vault
     */
    mapping(address => Vault) public vaults;

    /**
     * @notice Emitted when an account deposits collateral
     */
    event Deposited(address account, uint amount);

    /**
     * @notice Emitted when an account deposits collateral
     */
    event Minted(address account, uint amount);

    /**
     * @notice Emitted when an account repays collateral in a vault
     */
    event Repaid(address repayer, address vault, uint amount);

    /**
     * @notice Emitted when an account withdraws collateral in a vault
     */
    event Withdrew(address account, uint amount);

    /**
     * @notice Emitted when an account withdraws all collateral from an expired instrument
     */
    event WithdrewExpired(address account, uint amount);

    /**
     * @notice Emitted when dTokens are redeemed
     */
    event Redeemed(address account, uint dTokenAmount, uint collateralAmount);


    /**
     * @notice Emitted when the instrument is settled
     */
    event Settled(
        uint timestamp,
        uint settlePrice,
        uint targetAssetPrice,
        uint collateralAssetPrice
    );

    /**
     * @notice Emitted when a vault is liquidated
     */
    event Liquidated(
        address liquidator,
        address liquidated,
        uint liquidateAmount,
        uint collateralLiquidated,
        uint newLiquidatorCollateral,
        uint newLiquidatorDebt
    );

    /**
     * @notice Changes `expired` to True if timestamp is greater than expiry
     * It calculates the `settlePrice` with the current prices of target and
     * collateral assets, then sets them in stone.
     */
    function settle() public {
        require(block.timestamp > expiry, "Instrument has not expired");
        expired = true;

        // Set settlePrice to the current price of target and collat assets
        DataProviderInterface data = DataProviderInterface(dataProvider);
        uint targetAssetPrice = data.getPrice(targetAsset);
        uint collateralAssetPrice = data.getPrice(collateralAsset);
        
        settlePrice = computeSettlePrice(targetAssetPrice, collateralAssetPrice);

        emit Settled(block.timestamp, settlePrice, targetAssetPrice, collateralAssetPrice);
    }

    /**
     * @notice Gets the price of collateral asset
     */
    function getColPrice() public view returns(uint) {
        DataProviderInterface data = DataProviderInterface(dataProvider);
        return data.getPrice(collateralAsset);
    }

    /**
     * @notice Gets the price of target asset
     */
    function getTargetPrice() public view returns(uint) {
        DataProviderInterface data = DataProviderInterface(dataProvider);
        return data.getPrice(targetAsset);
    }

    /**
     * @notice Gets the collateral and debt of a vault
     * @param _user user's address
     */
    function getVault(address _user) public view returns(uint _collateral, uint _dTokenDebt) {
        Vault memory vault = vaults[_user];
        return (vault.collateral, vault.dTokenDebt);
    }

    /**
     * @notice Gets col ratio of a vault given new colAmount and dTokenAmount
     * @param _user address of vault
     * @param _colAmount amount of collateral to change
     * @param _colSign true if adding, false if removing
     * @param _dTokenAmount amount of dTokenAmount to change
     * @param _dTokenSign true if adding, false if removing
     */
    function getNewColRatio(address _user, uint _colAmount, bool _colSign, uint _dTokenAmount, bool _dTokenSign) public view returns(uint) {
        uint newCol;
        uint newDebt;
        Vault memory vault = vaults[_user];
        if (_colSign) {
            newCol = add(vault.collateral, _colAmount);
        } else {
            newCol = sub(vault.collateral, _colAmount);
        }

        if (_dTokenSign) {
            newDebt = add(vault.dTokenDebt, _dTokenAmount);
        } else {
            newDebt = sub(vault.dTokenDebt, _dTokenAmount);
        }

        DataProviderInterface data = DataProviderInterface(dataProvider);
        return computeColRatio(
            data.getPrice(collateralAsset),
            data.getPrice(targetAsset),
            newCol,
            newDebt
        );
    }

    /**
     * @notice Deposits collateral into the system. Calls the `depositInteral` function
     * @param _amount is amount of collateral to deposit
     */
    function deposit(uint _amount) public nonReentrant {
        depositInternal(_amount);
    }

    /**
     * @notice Deposits collateral into the Instrument contract and credits the caller's vault
     * @param _amount is amount of collateral to deposit
     */
    function depositInternal(uint _amount) internal {
        require(!expired, "Instrument must not be expired");

        IERC20 colToken = IERC20(collateralAsset);
      
        Vault storage vault = vaults[msg.sender];
        vault.collateral = add(vault.collateral, _amount);
      
        colToken.safeTransferFrom(msg.sender, address(this), _amount);
        emit Deposited(msg.sender, _amount);
    }

    /**
     * @notice Mints dTokens. Calls the `mintInternal` function
     * @param _amount is amount of dToken to mint
     */
    function mint(uint _amount) public nonReentrant {
        mintInternal(_amount);
    }

    /**
     * @notice Mints dTokens and debits the debt in the caller's vault
     * @param _amount is amount of dToken to mint
     */
    function mintInternal(uint _amount) internal {
        require(!expired, "Instrument must not be expired");
        DataProviderInterface data = DataProviderInterface(dataProvider);
        Vault storage vault = vaults[msg.sender];

        uint newDebt = add(vault.dTokenDebt, _amount);
        uint newColRatio = computeColRatio(
            data.getPrice(collateralAsset),
            data.getPrice(targetAsset),
            vault.collateral,
            newDebt);

        require(
            newColRatio >= collateralizationRatio,
            "Collateralization ratio too low"
        );
        vault.dTokenDebt = newDebt;
        totalDebt = add(totalDebt, _amount);

        DToken dTokenContract = DToken(dToken);
        dTokenContract.mint(msg.sender, _amount);
        emit Minted(msg.sender, _amount);
    }

    /**
     * @notice Deposits collateral and mints dToken atomically
     * @param _collateral is amount of collateral to deposit
     * @param _dToken is amount of dTokens to mint
     */
    function depositAndMint(uint256 _collateral, uint256 _dToken) external nonReentrant {
        depositInternal(_collateral);
        mintInternal(_dToken);
    }

    // /**
    //  * @notice Liquidates a vault using collateral and debt from another vault
    //  * @param _liquidator is the address of the liquidator
    //  * @param _liquidatee is the address of the vault being liquidated
    //  * @param _dTokenAmount is the dToken debt amount to be repaid for the liquidation
    //  * @param _liquidationIncentive the % amount of collateral the liquidators can take as a reward
    //  */
    function liquidateFromVault(
        address _liquidator,
        address _liquidatee,
        uint256 _dTokenAmount,
        uint256 _liquidationIncentive
    ) external nonReentrant {
        // No other caller except the assigned proxy can liquidate
        require(msg.sender == liquidatorProxy, "Only liquidatorProxy");
        require(!expired, "Instrument must not be expired");
        
        Vault storage liquidatorVault = vaults[_liquidator];
        Vault storage liquidatedVault = vaults[_liquidatee];
        uint256 liquidateeDTokenDebt = liquidatedVault.dTokenDebt;
        uint256 liquidateeCollateral = liquidatedVault.collateral;

        require(_dTokenAmount <= liquidateeDTokenDebt, "Cannot liquidate more than debt");

        DataProviderInterface data = DataProviderInterface(dataProvider);
        uint256 collateralPrice = data.getPrice(collateralAsset);
        uint256 targetPrice = data.getPrice(targetAsset);

        // Check if the vault is under the Instrument's collateralizationRatio
        uint256 minColRatio = collateralizationRatio;
        require(
            computeColRatio(collateralPrice, targetPrice, liquidateeCollateral, liquidateeDTokenDebt) < minColRatio,
            "Vault not liquidatable"
        );

        // Calculates the outcome for the liquidator's vault
        (uint256 collateralLiquidated, uint256 newLiquidatorCollateral, uint256 newLiquidatorDebt) = calculateLiquidationVaultOutcome(
            liquidatorVault.collateral, liquidatorVault.dTokenDebt, _dTokenAmount, _liquidationIncentive, targetPrice, collateralPrice);

        // After the liquidator accepts the new debt and collateral * 1.05,
        // We need to check that the liquidator is still overcollateralized
        require(
            computeColRatio(collateralPrice, targetPrice, newLiquidatorCollateral, newLiquidatorDebt) >= minColRatio,
            "Liquidator is undercollateralized"
        );

        // This covers the cases where the vault is underwater
        // Just liquidate the entire vault's collateral if the calculated collateralLiquidated is more than vault's collateral
        if (collateralLiquidated > liquidateeCollateral) {
            collateralLiquidated = liquidateeCollateral;
        }

        // Finally we have to assign the new values to the liquidator and liquidated vault
        liquidatorVault.collateral = newLiquidatorCollateral;
        liquidatorVault.dTokenDebt = newLiquidatorDebt;
        liquidatedVault.collateral = sub(liquidateeCollateral, collateralLiquidated);

        // The repayDebtInternal subtracts the debt amount
        repayDebtInternal(_liquidator, _liquidatee, _dTokenAmount);
        emit Liquidated(_liquidator, _liquidatee, _dTokenAmount, collateralLiquidated, newLiquidatorCollateral, newLiquidatorDebt);
    }

    /**
     * @notice Calculates the liquidator vault's collateral and debt after a liquidation
     * @param _originalLiquidatorCollateral is the collateral amount the liquidator vault has
     * @param _originalLiquidatorDebt is the debt amount the liquidator vault has
     * @param _dTokenAmount is the dToken debt amount to be repaid for the liquidation
     * @param _liquidationIncentive the % amount of collateral the liquidators can take as a reward
     * @param _targetPrice target asset price
     * @param _collateralPrice collateral asset price
     */
    function calculateLiquidationVaultOutcome(
        uint256 _originalLiquidatorCollateral,
        uint256 _originalLiquidatorDebt,
        uint256 _dTokenAmount,
        uint256 _liquidationIncentive,
        uint256 _targetPrice,
        uint256 _collateralPrice
    ) internal pure returns(uint256, uint256, uint256) {
        uint256 debtValue = wmul(_dTokenAmount, _targetPrice); // in ETH
        uint256 collateralValue = wdiv(debtValue, _collateralPrice); // in collateral tokens
        uint256 collateralLiquidated = wmul(collateralValue, _liquidationIncentive);

        uint256 newLiquidatorCollateral = add(_originalLiquidatorCollateral, collateralLiquidated);
        uint256 newLiquidatorDebt = add(_originalLiquidatorDebt, _dTokenAmount);
        return (collateralLiquidated, newLiquidatorCollateral, newLiquidatorDebt);
    }

    /**
     * @notice Checks if vault is under collateralized
     * @param _vaultOwner is the vault to check if it is liquidatable
     */
    function isLiquidatable(address _vaultOwner) external view returns (bool) {
        uint256 colRatio = vaultCollateralizationRatio(_vaultOwner);
        return colRatio < collateralizationRatio;
    }

    /**
     * @notice Helper function to get the collateralization ratio of a vault
     * @param _vaultOwner is the address used to lookup the vault
     */
    function vaultCollateralizationRatio(address _vaultOwner) public view returns(uint256) {
        (uint256 collateral, uint256 debt) = getVault(_vaultOwner);
        DataProviderInterface data = DataProviderInterface(dataProvider);
        return computeColRatio(
            data.getPrice(collateralAsset),
            data.getPrice(targetAsset),
            collateral,
            debt
        );
    }

    /**
     * @notice Repays dToken debt in a vault
     * @param _repayer is the address who is paying down the debt with dTokens
     * @param _account is the address which debt is being repaid
     * @param _amount is amount of dToken to repay
     */
    function repayDebtInternal(address _repayer, address _account, uint _amount) internal {
        // Only the liquidator proxy can repay debt on behalf of liquidators
        if (msg.sender != _account) {
            require(msg.sender == liquidatorProxy, "Only liquidatorProxy");
        }

        Vault storage vault = vaults[_account];
        require(vault.dTokenDebt >= _amount, "Cannot repay more debt than exists");
        
        vault.dTokenDebt = sub(vault.dTokenDebt, _amount);
        totalDebt = sub(totalDebt, _amount);

        DToken dTokenContract = DToken(dToken);
        dTokenContract.burn(_repayer, _amount);
        emit Repaid(_repayer, _account, _amount);
    }

    /**
     * @notice Repays dToken debt in a vault
     * @param _account is the address which debt is being repaid
     * @param _amount is amount of dToken to repay
     */
    function repayDebt(address _account, uint _amount) public nonReentrant {
        repayDebtInternal(msg.sender, _account, _amount);
    }

    /**
     * @notice Withdraws collateral after instrument is expired
     */
    function withdrawCollateralExpired() external nonReentrant {
        require(expired, "Instrument must be expired");
        Vault storage vault = vaults[msg.sender];

        uint withdrawableColAmount = wmul(settlePrice, vault.dTokenDebt);
        vault.collateral = sub(vault.collateral, withdrawableColAmount);
        IERC20 colToken = IERC20(collateralAsset);
        colToken.safeTransfer(msg.sender, withdrawableColAmount);
        emit WithdrewExpired(msg.sender, withdrawableColAmount);
    }

    /**
     * @notice Withdraws collateral while the instrument is active
     * @param _amount is amount of collateral to withdraw
     */
    function withdrawCollateral(uint _amount) external nonReentrant {
        withdrawCollateralInternal(msg.sender, _amount);
    }

    /**
     * @notice Withdraws collateral from a vault
     * @param _account is account that is withdrawing
     * @param _amount is amount of collateral to withdraw
     */
    function withdrawCollateralInternal(address _account, uint _amount) internal {
        require(!expired, "Instrument must not be expired");
        DataProviderInterface data = DataProviderInterface(dataProvider);
        Vault storage vault = vaults[_account];

        uint newCol = sub(vault.collateral, _amount);
        uint newColRatio = computeColRatio(
            data.getPrice(collateralAsset),
            data.getPrice(targetAsset),
            newCol,
            vault.dTokenDebt);
        
        require(
            newColRatio >= collateralizationRatio,
            "Collateralization ratio too low to withdraw"
        );
        vault.collateral = newCol;

        IERC20 colToken = IERC20(collateralAsset);
        colToken.safeTransfer(_account, _amount);
        emit Withdrew(msg.sender, _amount);
    }

    /**
     * @notice Redeems dToken for collateral after expiry
     * @param _dTokenAmount is amount of dTokens to redeem
     */
    function redeem(uint _dTokenAmount) external nonReentrant {
        require(expired, "Instrument must be expired");

        uint withdrawableColAmount = wmul(settlePrice, _dTokenAmount);

        totalDebt = sub(totalDebt, _dTokenAmount);

        DToken dTokenContract = DToken(dToken);
        dTokenContract.burn(msg.sender, _dTokenAmount);
        
        IERC20 colTokenContract = IERC20(collateralAsset);
        colTokenContract.safeTransfer(msg.sender, withdrawableColAmount);

        emit Redeemed(msg.sender, _dTokenAmount, withdrawableColAmount);
    }

    /**
     * @notice Computes col ratio
     * @dev 150% CR will be represented as 1.5 * WAD
     * @param _colPrice is the spot price of collateral asset in WAD
     * @param _targetPrice is the spot price of the target asset in WAD
     * @param _colAmount is the amount of collateral in WAD
     * @param _targetAmount is the amount of dTokens in WAD
     */
    function computeColRatio(
        uint _colPrice,
        uint _targetPrice,
        uint _colAmount,
        uint _targetAmount
    ) internal pure returns (uint) {
        uint col = wmul(_colPrice, _colAmount);
        uint debt = wmul(_targetAmount, _targetPrice);
        if (debt == 0) {
            return type(uint256).max;
        }
        return wdiv(col, debt);
    }

    /**
     * @notice Returns the number of collateralAsset that can be exchanged for 1 dToken.
     * @dev 1:1 is denominated as 1*WAD
     * @param _targetPrice is the spot price of the target asset in WAD
     * @param _colPrice is the spot price of collateral asset in WAD
     */
    function computeSettlePrice(
        uint _targetPrice,
        uint _colPrice
    ) internal pure returns (uint) {
        return wdiv(_targetPrice, _colPrice);
    }
}
