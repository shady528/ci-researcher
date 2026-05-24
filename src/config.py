import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass
class LLMConfig:
    model: str
    temperature: float
    api_key: str


@dataclass
class GraphConfig:
    planner: LLMConfig
    validator: LLMConfig
    analyst: LLMConfig
    report_gen: LLMConfig

    @classmethod
    def from_env(cls) -> "GraphConfig":
        api_key = os.getenv("OPENAI_API_KEY", "")
        return cls(
            planner=LLMConfig(
                model=os.getenv("PLANNER_MODEL", "gpt-4o"),
                temperature=float(os.getenv("PLANNER_TEMPERATURE", "0.2")),
                api_key=api_key,
            ),
            validator=LLMConfig(
                model=os.getenv("VALIDATOR_MODEL", "gpt-4o-mini"),
                temperature=float(os.getenv("VALIDATOR_TEMPERATURE", "0.0")),
                api_key=api_key,
            ),
            analyst=LLMConfig(
                model=os.getenv("ANALYST_MODEL", "gpt-4o"),
                temperature=float(os.getenv("ANALYST_TEMPERATURE", "0.1")),
                api_key=api_key,
            ),
            report_gen=LLMConfig(
                model=os.getenv("REPORT_MODEL", "gpt-4o"),
                temperature=float(os.getenv("REPORT_TEMPERATURE", "0.2")),
                api_key=api_key,
            ),
        )
