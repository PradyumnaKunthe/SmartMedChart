from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "41d1b32d81f2"
down_revision: Union[str, Sequence[str], None] = "54597ed7635a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table(
        "encounters",
        schema=None,
        recreate="always",
    ) as batch_op:
        batch_op.create_foreign_key(
            "fk_encounters_doctor_id_users",
            "users",
            ["doctor_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table(
        "encounters",
        schema=None,
        recreate="always",
    ) as batch_op:
        batch_op.drop_constraint(
            "fk_encounters_doctor_id_users",
            type_="foreignkey",
        )