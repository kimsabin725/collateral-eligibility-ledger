// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

interface IEligibilityLedger {
    function isCreditGated(address asset) external view returns (bool);
    function impairedSince(address asset) external view returns (uint64);
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title GatedCreditLine
 * @notice A minimal credit venue on Creditcoin that consults an {EligibilityLedger} before
 *         extending new credit against a collateral asset controlled on another chain.
 *
 * @dev This stands in for the real pattern the ledger is built for: the asset's control lives on
 *      Ethereum while the credit is extended somewhere else — USDe controlled on Ethereum and lent
 *      against on Robinhood Chain, Centrifuge pools whose hub is Ethereum with share tokens lent
 *      against on Base. Here Creditcoin is that other chain.
 *
 *      SCOPE. Deliberately no interest accrual, no price oracle and no liquidation engine: this
 *      exercises the ELIGIBILITY axis only. Do not present it as a lending protocol.
 *
 *      EXITS ARE NEVER GATED. Impairment blocks new credit; it must never trap an existing
 *      borrower. `repay` and `withdrawCollateral` stay open in every state — a gate that also
 *      locks the exit converts a risk control into a hostage situation.
 */
contract GatedCreditLine {
    struct Market {
        bool listed;
        IERC20 collateral;
        IERC20 loanAsset;
        uint16 ltvBps;        // e.g. 9200 = 92%
    }

    struct Position {
        address owner;
        address collateralAsset;
        uint256 collateral;
        uint256 debt;
        uint64 openedAtBlock;
        uint64 openedAtTime;
    }

    address public immutable owner;
    IEligibilityLedger public immutable LEDGER;

    mapping(address => Market) public markets;   // keyed by collateral asset
    Position[] public positions;
    mapping(address => uint256[]) public positionsOf;

    event MarketListed(address indexed collateral, address loanAsset, uint16 ltvBps);
    event Opened(uint256 indexed id, address indexed borrower, address indexed collateralAsset,
                 uint256 collateral, uint256 debt);
    event Borrowed(uint256 indexed id, uint256 amount, uint256 newDebt);
    event Repaid(uint256 indexed id, uint256 amount, uint256 newDebt);
    event CollateralWithdrawn(uint256 indexed id, uint256 amount, uint256 remaining);
    event CreditRefused(address indexed collateralAsset, address indexed borrower, uint64 impairedSince);

    error NotOwner();
    error NotBorrower();
    error MarketNotListed(address collateralAsset);
    error AssetImpaired(address collateralAsset, uint64 impairedSince);
    error ExceedsLtv(uint256 debt, uint256 maxDebt);
    error NothingToDo();

    constructor(address ledger) {
        owner = msg.sender;
        LEDGER = IEligibilityLedger(ledger);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @dev New credit is refused while the collateral asset has a proven, unrestored impairment.
    modifier creditAllowed(address collateralAsset) {
        if (LEDGER.isCreditGated(collateralAsset)) {
            uint64 since = LEDGER.impairedSince(collateralAsset);
            emit CreditRefused(collateralAsset, msg.sender, since);
            revert AssetImpaired(collateralAsset, since);
        }
        _;
    }

    function listMarket(address collateral, address loanAsset, uint16 ltvBps) external onlyOwner {
        markets[collateral] = Market({
            listed: true, collateral: IERC20(collateral), loanAsset: IERC20(loanAsset), ltvBps: ltvBps
        });
        emit MarketListed(collateral, loanAsset, ltvBps);
    }

    /// @notice Fund the venue's lendable balance.
    function fund(address collateralAsset, uint256 amount) external onlyOwner {
        Market storage m = _market(collateralAsset);
        m.loanAsset.transferFrom(msg.sender, address(this), amount);
    }

    // ───────────────────────────── credit path ───────────────────────────

    function openPosition(address collateralAsset, uint256 collateralAmount, uint256 borrowAmount)
        external creditAllowed(collateralAsset) returns (uint256 id)
    {
        Market storage m = _market(collateralAsset);
        if (collateralAmount == 0) revert NothingToDo();
        _requireWithinLtv(m, collateralAmount, borrowAmount);

        m.collateral.transferFrom(msg.sender, address(this), collateralAmount);

        positions.push(Position({
            owner: msg.sender,
            collateralAsset: collateralAsset,
            collateral: collateralAmount,
            debt: borrowAmount,
            openedAtBlock: uint64(block.number),
            openedAtTime: uint64(block.timestamp)
        }));
        id = positions.length - 1;
        positionsOf[msg.sender].push(id);

        if (borrowAmount > 0) m.loanAsset.transfer(msg.sender, borrowAmount);
        emit Opened(id, msg.sender, collateralAsset, collateralAmount, borrowAmount);
    }

    function borrowMore(uint256 id, uint256 amount) external {
        Position storage p = _own(id);
        Market storage m = _market(p.collateralAsset);
        if (LEDGER.isCreditGated(p.collateralAsset)) {
            uint64 since = LEDGER.impairedSince(p.collateralAsset);
            emit CreditRefused(p.collateralAsset, msg.sender, since);
            revert AssetImpaired(p.collateralAsset, since);
        }
        _requireWithinLtv(m, p.collateral, p.debt + amount);
        p.debt += amount;
        m.loanAsset.transfer(msg.sender, amount);
        emit Borrowed(id, amount, p.debt);
    }

    /// @notice Adding collateral is new credit exposure to the asset, so it is gated too.
    function addCollateral(uint256 id, uint256 amount)
        external creditAllowed(positions[id].collateralAsset)
    {
        Position storage p = _own(id);
        Market storage m = _market(p.collateralAsset);
        p.collateral += amount;
        m.collateral.transferFrom(msg.sender, address(this), amount);
    }

    // ──────────────────── exits — never gated, by design ─────────────────

    function repay(uint256 id, uint256 amount) external {
        Position storage p = _own(id);
        Market storage m = _market(p.collateralAsset);
        uint256 pay = amount > p.debt ? p.debt : amount;
        p.debt -= pay;
        m.loanAsset.transferFrom(msg.sender, address(this), pay);
        emit Repaid(id, pay, p.debt);
    }

    function withdrawCollateral(uint256 id, uint256 amount) external {
        Position storage p = _own(id);
        Market storage m = _market(p.collateralAsset);
        p.collateral -= amount;
        _requireWithinLtv(m, p.collateral, p.debt);
        m.collateral.transfer(msg.sender, amount);
        emit CollateralWithdrawn(id, amount, p.collateral);
    }

    // ───────────────────────────── read paths ────────────────────────────

    /// @notice Positions that were opened against an asset before its impairment was proven here.
    /// @dev Reported, never auto-liquidated: the ledger proves an event happened, not that any
    ///      particular borrower did anything wrong.
    function exposedPositions(address collateralAsset) external view returns (uint256[] memory ids) {
        uint256 n;
        for (uint256 i; i < positions.length; ++i) {
            if (positions[i].collateralAsset == collateralAsset && positions[i].debt > 0) ++n;
        }
        ids = new uint256[](n);
        uint256 k;
        for (uint256 i; i < positions.length; ++i) {
            if (positions[i].collateralAsset == collateralAsset && positions[i].debt > 0) ids[k++] = i;
        }
    }

    function positionCount() external view returns (uint256) { return positions.length; }
    function getPosition(uint256 id) external view returns (Position memory) { return positions[id]; }
    function positionsOfBorrower(address who) external view returns (uint256[] memory) {
        return positionsOf[who];
    }

    // ────────────────────────────── internals ────────────────────────────

    function _market(address collateralAsset) internal view returns (Market storage m) {
        m = markets[collateralAsset];
        if (!m.listed) revert MarketNotListed(collateralAsset);
    }

    function _own(uint256 id) internal view returns (Position storage p) {
        p = positions[id];
        if (p.owner != msg.sender) revert NotBorrower();
    }

    function _requireWithinLtv(Market storage m, uint256 collateral, uint256 debt) internal view {
        uint256 maxDebt = (collateral * m.ltvBps) / 10_000;
        if (debt > maxDebt) revert ExceedsLtv(debt, maxDebt);
    }
}
