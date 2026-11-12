## ADDED Requirements

### Requirement: Built-in official runtime
DSH SHALL distribute an exactly pinned official OpenSpec runtime in every shipped profile without requiring runtime package downloads.

#### Scenario: Fresh installation
- **WHEN** a user starts a shipped DSH profile
- **THEN** the OpenSpec tool and mandatory mutation policy are composed without installing an optional bundle

### Requirement: Human approval before implementation
DSH SHALL deny mutation-capable and unclassified tool execution until the requesting agent obtains explicit human approval for a concrete OpenSpec change containing a proposal, design, requirements, and task plan.

#### Scenario: Unapproved shell execution
- **WHEN** an agent requests shell execution without approved change artifacts
- **THEN** DSH denies the call even if normal sandbox permissions allow it

#### Scenario: Read-only investigation
- **WHEN** an agent uses a configured read-only tool without approved change artifacts
- **THEN** DSH permits the call subject to existing permission and sandbox policies

#### Scenario: Missing or dismissed review
- **WHEN** the review channel is unavailable or the user skips or declines review
- **THEN** DSH does not authorize implementation

### Requirement: Approval is bound to the reviewed work
DSH SHALL bind approval to the calling agent, working directory, selected change, and specification and plan contents. It SHALL NOT infer approval from model text or inherit another agent's approval.

#### Scenario: Requirements change
- **WHEN** reviewed requirements or plan text changes
- **THEN** the next protected call is denied until a new review succeeds

#### Scenario: Task completion tracking
- **WHEN** only task checkbox completion changes
- **THEN** the original approval remains valid

#### Scenario: New task or restarted agent
- **WHEN** a new human task begins, the turn ends, or the agent is recreated
- **THEN** implementation requires another review

### Requirement: Restricted preparation
DSH SHALL permit pre-approval preparation only through bounded OpenSpec operations. It SHALL reject path traversal, symlink escapes, arbitrary CLI arguments, and writes outside the selected change artifacts. Existing sandbox restrictions SHALL still apply.

#### Scenario: Planning path traversal
- **WHEN** an agent attempts to write a planning artifact outside its selected change
- **THEN** the operation fails without changing that target
