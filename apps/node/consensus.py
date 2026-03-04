"""Vote tracking and consensus logic for market resolution."""


class ConsensusTracker:
    """Tracks resolver votes for a market and determines consensus."""

    def __init__(self, market_id: str, min_resolvers: int):
        self.market_id = market_id
        self.min_resolvers = min_resolvers
        self.votes: dict[str, str] = {}  # pubkey -> verdict

    def add_vote(self, pubkey: str, verdict: str) -> bool:
        """Add a vote. Returns True if quorum is now reached."""
        if verdict not in ('YES', 'NO', 'INVALID'):
            return False
        self.votes[pubkey] = verdict
        return self.has_quorum()

    def has_quorum(self) -> bool:
        return len(self.votes) >= self.min_resolvers

    def tally(self) -> dict[str, int]:
        return {
            'YES': sum(1 for v in self.votes.values() if v == 'YES'),
            'NO': sum(1 for v in self.votes.values() if v == 'NO'),
            'INVALID': sum(1 for v in self.votes.values() if v == 'INVALID'),
        }

    def outcome(self) -> str | None:
        """Returns the consensus outcome, or None if no quorum."""
        if not self.has_quorum():
            return None
        tally = self.tally()
        return max(tally, key=lambda k: tally[k])

    def should_call_consensus(self, my_pubkey: str) -> bool:
        """The lowest pubkey lexicographically among resolvers calls consensus."""
        if not self.has_quorum():
            return False
        lowest = min(self.votes.keys())
        return lowest <= my_pubkey

    def dissenting_pubkeys(self) -> list[str]:
        """Returns pubkeys that voted against the consensus outcome."""
        consensus = self.outcome()
        if consensus is None or consensus == 'INVALID':
            return []
        return [pk for pk, v in self.votes.items() if v != consensus]

    def honest_pubkeys(self) -> list[str]:
        """Returns pubkeys that voted with the consensus outcome."""
        consensus = self.outcome()
        if consensus is None:
            return []
        return [pk for pk, v in self.votes.items() if v == consensus]
