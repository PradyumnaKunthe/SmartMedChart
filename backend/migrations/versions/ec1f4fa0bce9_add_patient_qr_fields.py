"""Add patient QR fields

Revision ID: ec1f4fa0bce9
Revises: 2e333dfcc43d
Create Date: 2026-08-26 15:05:29.007166

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "ec1f4fa0bce9"
down_revision: Union[str, Sequence[str], None] = "2e333dfcc43d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # qr_token already exists because the previous migration
    # attempt added it before failing.
    #
    # qr_generated_at already exists for the same reason.

    # Add only the missing column.
    op.add_column(
        "patients",
        sa.Column(
            "qr_is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )

    # Add the missing unique index for qr_token.
    op.create_index(
        op.f("ix_patients_qr_token"),
        "patients",
        ["qr_token"],
        unique=True,
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_index(
        op.f("ix_patients_qr_token"),
        table_name="patients",
    )

    op.drop_column(
        "patients",
        "qr_is_active",
    )

    # These two columns were created by the original partial
    # migration attempt, so remove them when downgrading.
    op.drop_column(
        "patients",
        "qr_generated_at",
    )

    op.drop_column(
        "patients",
        "qr_token",
    )