import logging
from typing import Literal

from app.services.document.extraction_tree import ProcessorResult

logger = logging.getLogger(__name__)

class TableProcessor:

    def __init__(self):
        pass

    def process(
        self,
        table_data: list[list[str]],
        format: Literal["markdown", "plain"] = "markdown") -> ProcessorResult:

        try:

            if not table_data:
                return ProcessorResult(
                    success = False,
                    error = "No data provided")

            match format:
                case "markdown":
                    output_text = self._to_markdown(table_data)
                case "plain":
                    output_text = self._to_plain_text(table_data)
                case _:
                    output_text = self._to_markdown(table_data)

            logger.debug(f"Converted table to {format} format")

            return ProcessorResult(
                success = True,
                output_text = output_text)

        except Exception as e:

            logger.error(f"Table processing failed: {e}")
            return ProcessorResult(
                success = False,
                error = str(e))

    def _to_markdown(self, table_data: list[list[str]]) -> str:

        if not table_data:
            return ""

        lines = []

        if len(table_data) > 0:

            header = "| " + " | ".join(str(cell) for cell in table_data[0]) + " |"
            lines.append(header)
            separator = "|" + "|".join([" --- " for _ in table_data[0]]) + "|"
            lines.append(separator)

        for row in table_data[1:]:

            row_text = "| " + " | ".join(str(cell) for cell in row) + " |"
            lines.append(row_text)

        return "\n".join(lines)

    def _to_plain_text(self, table_data: list[list[str]]) -> str:

        if not table_data:
            return ""

        lines = []
        for row in table_data:
            lines.append("\t".join(str(cell) for cell in row))

        return "\n".join(lines)

# Global instance
table_processor = TableProcessor()
