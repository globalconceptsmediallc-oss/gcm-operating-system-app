# Application Architecture Standard

**Version:** 1.0 Foundation
**Status:** Active Standard
**Repository:** gcm-operating-system-app

---

# Purpose

This standard defines how every application inside the Global Concepts Media Operating System must be designed, built, and expanded.

GCM OS is not a website.

GCM OS is an operating environment that allows users to execute the standards stored inside Global Concepts Media repositories.

---

# Core Rule

Applications may execute standards, but they may never define standards.

Standards live in the repositories.

Applications provide the interface, workflow, validation, Markdown generation, and eventual GitHub integration required to execute those standards.

---

# The Four Required Questions

Every application inside GCM OS must answer four questions before it is built.

## 1. What standard does this application execute?

The application must be tied to a documented standard.

Example:

Business Intelligence App executes the Business Intelligence Brief Standard.

## 2. What information must the user provide?

The required inputs must be clear, structured, and tied to the standard being executed.

The application should guide the user through the work instead of forcing the user to remember what information is needed.

## 3. What standardized record does it produce?

Every completed workflow must generate a Markdown record.

The output must be clean, consistent, and ready for repository use.

## 4. Which repository becomes the source of truth?

The generated record must belong to a specific repository.

The application does not become the source of truth.

The repository remains the permanent record.

---

# Application Responsibilities

Each application may handle:

* User interface
* Guided workflow
* Required fields
* Input validation
* Markdown generation
* File naming
* Download preparation
* Future GitHub integration

Each application may not handle:

* Defining business standards
* Replacing repository documentation
* Creating undocumented workflows
* Storing permanent business records outside the repository

---

# Version 1 Application Rules

Version 1 applications must remain simple.

They should use:

* HTML
* CSS
* JavaScript
* Markdown generation
* Browser-based file output

They should not use:

* Databases
* Authentication
* Backend services
* Artificial intelligence
* User accounts
* Complex permissions

Version 1 proves that the operating system can execute real business standards before additional technology is added.

---

# Required Application Structure

Each application should contain:

## Application Name

The clear name of the application.

## Standard Executed

The repository standard the application is designed to execute.

## User Inputs

The information the user must provide.

## Generated Output

The Markdown document the application produces.

## Source Repository

The repository where the generated document belongs.

## Workflow

The step-by-step process the user follows.

## Validation

The rules that prevent incomplete or unusable output.

---

# First Application

The first application inside GCM OS is:

Business Intelligence Brief Generator

It executes the Business Intelligence Brief Standard and produces a completed Business Intelligence Brief in Markdown format.

---

# Long-Term Direction

Future GCM OS applications may include:

* Business Intelligence
* Client Acquisition
* CRM
* Discovery Meetings
* Recommendations
* Proposal Builder
* Client Onboarding
* Business Growth
* Reporting
* Metrics
* Knowledge Base
* AI Assistant
* GitHub Integration

Each application must follow this architecture standard before it is built.

---

# Final Principle

Repositories define the operating system.

Applications execute the operating system.

Markdown records prove the work was completed.
